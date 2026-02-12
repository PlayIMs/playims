import { DatabaseOperations } from '$lib/database';
import { dev } from '$app/environment';
import { clearSessionCookie, resolveSessionFromRequest } from '$lib/server/auth/session';
import type { AuthRole } from '$lib/server/auth/rbac';
import { DASHBOARD_ALLOWED_ROLES, hasAnyRole } from '$lib/server/auth/rbac';
import { AuthServiceError, requireSessionSecret } from '$lib/server/auth/service';
import { AUTH_SESSION_COOKIE_NAME } from '$lib/server/auth/constants';
import {
	getApiTableFromPath,
	getErrorFromPayload,
	getRecordCountFromPayload,
	getSsrTableFromPath,
	isStaticAssetRequestPath,
	logRequestSummary,
	nowMs
} from '$lib/server/request-logger';
import type { Handle, RequestEvent } from '@sveltejs/kit';

/**
 * Central request security pipeline.
 *
 * Responsibilities:
 * 1) Hydrate auth session into locals.
 * 2) Enforce API/page auth + RBAC policy.
 * 3) Apply CSRF origin checks for mutating requests.
 * 4) Apply lightweight per-route rate limits.
 * 5) Emit consistent request logs and security headers.
 */
type RateLimitConfig = {
	windowMs: number;
	maxRequests: number;
};

type ApiAccessPolicy =
	| {
			access: 'public';
	  }
	| {
			access: 'authenticated';
	  }
	| {
			access: 'role';
			roles: readonly AuthRole[];
	  };

type ApiRoutePolicy = {
	pattern: RegExp;
	policy: ApiAccessPolicy;
};

// Single source of truth for API access requirements.
const API_ROUTE_POLICIES: ApiRoutePolicy[] = [
	{ pattern: /^\/api\/auth\/login$/, policy: { access: 'public' } },
	{ pattern: /^\/api\/auth\/register$/, policy: { access: 'public' } },
	{ pattern: /^\/api\/auth\/logout$/, policy: { access: 'authenticated' } },
	{ pattern: /^\/api\/auth\/session$/, policy: { access: 'authenticated' } },
	{ pattern: /^\/api\/auth\/switch-client$/, policy: { access: 'authenticated' } },
	{
		pattern: /^\/api\/address-suggest$/,
		policy: { access: 'role', roles: DASHBOARD_ALLOWED_ROLES }
	},
	{ pattern: /^\/api\/themes$/, policy: { access: 'role', roles: DASHBOARD_ALLOWED_ROLES } },
	{
		pattern: /^\/api\/themes\/current$/,
		policy: { access: 'role', roles: DASHBOARD_ALLOWED_ROLES }
	},
	{ pattern: /^\/api\/themes\/[^/]+$/, policy: { access: 'role', roles: DASHBOARD_ALLOWED_ROLES } },
	{
		pattern: /^\/api\/intramural-sports\/offerings$/,
		policy: { access: 'role', roles: DASHBOARD_ALLOWED_ROLES }
	}
];

const LOGIN_RATE_LIMIT: RateLimitConfig = {
	windowMs: 60_000,
	maxRequests: 12
};

const REGISTER_RATE_LIMIT: RateLimitConfig = {
	windowMs: 10 * 60_000,
	maxRequests: 6
};

const ADDRESS_SUGGEST_RATE_LIMIT: RateLimitConfig = {
	windowMs: 60_000,
	maxRequests: 60
};

const THEMES_RATE_LIMIT: RateLimitConfig = {
	windowMs: 60_000,
	maxRequests: 120
};

const AUTH_READ_RATE_LIMIT: RateLimitConfig = {
	windowMs: 60_000,
	maxRequests: 120
};

const INTRAMURAL_OFFERINGS_RATE_LIMIT: RateLimitConfig = {
	windowMs: 60_000,
	maxRequests: 60
};

// In-memory limiter is intentionally simple for this phase/local scale.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
let lastRateLimitCleanupAt = 0;

const PROTECTED_PAGE_PREFIXES = ['/dashboard'];
const PROTECTED_PAGE_EXACT = new Set(['/schedule', '/colors']);
const AUTH_PAGE_PATHS = new Set(['/log-in', '/register']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const resolveRateLimitConfig = (pathname: string): RateLimitConfig | null => {
	if (pathname === '/api/auth/login') {
		return LOGIN_RATE_LIMIT;
	}

	if (pathname === '/log-in') {
		return LOGIN_RATE_LIMIT;
	}

	if (pathname === '/api/auth/register') {
		return REGISTER_RATE_LIMIT;
	}

	if (pathname === '/register') {
		return REGISTER_RATE_LIMIT;
	}

	if (pathname === '/api/address-suggest') {
		return ADDRESS_SUGGEST_RATE_LIMIT;
	}

	if (pathname === '/api/themes' || pathname.startsWith('/api/themes/')) {
		return THEMES_RATE_LIMIT;
	}

	if (pathname === '/api/intramural-sports/offerings') {
		return INTRAMURAL_OFFERINGS_RATE_LIMIT;
	}

	if (
		pathname === '/api/auth/session' ||
		pathname === '/api/auth/logout' ||
		pathname === '/api/auth/switch-client'
	) {
		return AUTH_READ_RATE_LIMIT;
	}

	return null;
};

const cleanupRateLimitStore = (now: number) => {
	if (now - lastRateLimitCleanupAt < 120_000) {
		return;
	}
	lastRateLimitCleanupAt = now;

	for (const [key, bucket] of rateLimitStore.entries()) {
		if (bucket.resetAt <= now) {
			rateLimitStore.delete(key);
		}
	}
};

const consumeRateLimit = (key: string, config: RateLimitConfig, now: number) => {
	cleanupRateLimitStore(now);

	const existing = rateLimitStore.get(key);
	if (!existing || existing.resetAt <= now) {
		const resetAt = now + config.windowMs;
		rateLimitStore.set(key, { count: 1, resetAt });
		return { allowed: true, remaining: config.maxRequests - 1, resetAt };
	}

	if (existing.count >= config.maxRequests) {
		return { allowed: false, remaining: 0, resetAt: existing.resetAt };
	}

	existing.count += 1;
	rateLimitStore.set(key, existing);
	return {
		allowed: true,
		remaining: Math.max(0, config.maxRequests - existing.count),
		resetAt: existing.resetAt
	};
};

const isProtectedPagePath = (pathname: string) => {
	if (PROTECTED_PAGE_EXACT.has(pathname)) {
		return true;
	}

	return PROTECTED_PAGE_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
};

const isAuthPagePath = (pathname: string) => AUTH_PAGE_PATHS.has(pathname);

const sanitizeNextPath = (nextPath: string | null | undefined) => {
	if (!nextPath) {
		return null;
	}

	const trimmed = nextPath.trim();
	if (!trimmed.startsWith('/')) {
		return null;
	}

	if (trimmed.startsWith('//')) {
		return null;
	}

	if (trimmed.startsWith('/api/')) {
		return null;
	}

	return trimmed;
};

const getSafeSearch = (url: URL): string => {
	try {
		return url.search;
	} catch {
		return '';
	}
};

const getSafeSearchParam = (url: URL, key: string): string | null => {
	try {
		return url.searchParams.get(key);
	} catch {
		return null;
	}
};

const getApiPolicy = (pathname: string): ApiAccessPolicy | null => {
	const matched = API_ROUTE_POLICIES.find((entry) => entry.pattern.test(pathname));
	return matched?.policy ?? null;
};

const getClientAddress = (event: RequestEvent) => {
	try {
		return event.getClientAddress();
	} catch {
		const fromCf = event.request.headers.get('cf-connecting-ip');
		if (fromCf && fromCf.trim().length > 0) {
			return fromCf.trim();
		}

		const fromForwarded = event.request.headers.get('x-forwarded-for');
		if (fromForwarded && fromForwarded.trim().length > 0) {
			return fromForwarded.split(',')[0].trim();
		}

		return 'unknown';
	}
};

const isTrustedOrigin = (event: RequestEvent): boolean => {
	const origin = event.request.headers.get('origin');
	if (!origin) {
		return false;
	}

	return origin === event.url.origin;
};

const toApiErrorResponse = (
	status: number,
	requestId: string,
	code: string,
	message: string,
	extraHeaders?: Record<string, string>
) => {
	const headers = new Headers({
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store',
		...extraHeaders
	});

	return new Response(
		JSON.stringify({
			success: false,
			error: message,
			code,
			requestId
		}),
		{
			status,
			headers
		}
	);
};

const toPageErrorResponse = (
	status: number,
	message: string,
	extraHeaders?: Record<string, string>
) =>
	new Response(message, {
		status,
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'no-store',
			...extraHeaders
		}
	});

const withSecurityHeaders = (
	response: Response,
	{
		requestId,
		isApiRequest
	}: {
		requestId: string;
		isApiRequest: boolean;
	}
) => {
	const headers = new Headers(response.headers);

	headers.set('x-request-id', requestId);
	headers.set('x-content-type-options', 'nosniff');
	headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	headers.set('x-frame-options', 'DENY');
	headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');

	if (!dev) {
		headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload');
	}

	if (isApiRequest && !headers.has('content-security-policy')) {
		headers.set(
			'content-security-policy',
			"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
		);
	}

	if (isApiRequest && !headers.has('cache-control')) {
		// API payloads may contain session/user context; never allow caching by default.
		headers.set('cache-control', 'no-store');
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};

const toRedirectResponse = (location: string, status = 303) =>
	new Response(null, {
		status,
		headers: {
			location,
			'cache-control': 'no-store'
		}
	});

export const handle: Handle = async ({ event, resolve }) => {
	// Request ID is attached to responses/logs for support/debug traceability.
	event.locals.requestId = crypto.randomUUID();

	if (dev && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
		const response = new Response('Go away, Chrome DevTools!', { status: 404 });
		return withSecurityHeaders(response, {
			requestId: event.locals.requestId,
			isApiRequest: false
		});
	}

	const pathname = event.url.pathname;
	const isApiRequest = pathname.startsWith('/api/');
	const isSsrRequest = !isApiRequest && !isStaticAssetRequestPath(pathname);
	const isMutatingRequest = MUTATING_METHODS.has(event.request.method.toUpperCase());

	if (!isApiRequest && !isSsrRequest) {
		const response = await resolve(event);
		return withSecurityHeaders(response, {
			requestId: event.locals.requestId,
			isApiRequest: false
		});
	}

	const startedAt = nowMs();
	const method = event.request.method;
	const endpoint = `${event.url.pathname}${getSafeSearch(event.url)}`;
	const table = isApiRequest ? getApiTableFromPath(pathname) : getSsrTableFromPath(pathname);
	const scope = isApiRequest ? 'API' : 'SSR';

	let dbOps: DatabaseOperations | null = null;
	const getDbOps = () => {
		if (dbOps) {
			return dbOps;
		}

		if (!event.platform?.env?.DB) {
			throw new Error('DB_NOT_CONFIGURED');
		}

		dbOps = new DatabaseOperations(event.platform as App.Platform);
		return dbOps;
	};

	let authHydrationError: Error | null = null;
	const hasSessionCookie = Boolean(event.cookies.get(AUTH_SESSION_COOKIE_NAME));
	if (hasSessionCookie) {
		try {
			// Session resolution is centralized and never trusts client-provided user identity.
			const sessionSecret = requireSessionSecret(event);
			const authContext = await resolveSessionFromRequest(event, getDbOps(), sessionSecret);
			if (authContext) {
				event.locals.session = authContext.session;
				event.locals.user = authContext.user;
			}
		} catch (error) {
			authHydrationError = error instanceof Error ? error : new Error('AUTH_HYDRATION_FAILED');
			clearSessionCookie(event);
		}
	}

	if (isMutatingRequest && (isApiRequest || isSsrRequest) && !isTrustedOrigin(event)) {
		// Cookie auth + mutating methods require same-origin to reduce CSRF risk.
		const response = isApiRequest
			? toApiErrorResponse(
					403,
					event.locals.requestId,
					'CSRF_INVALID_ORIGIN',
					'Invalid request origin.'
				)
			: toPageErrorResponse(403, 'Invalid request origin.');

		logRequestSummary({
			scope,
			method,
			endpoint,
			table,
			recordCount: 0,
			status: 403,
			durationMs: nowMs() - startedAt,
			error: 'Blocked by CSRF origin enforcement'
		});

		return withSecurityHeaders(response, {
			requestId: event.locals.requestId,
			isApiRequest
		});
	}

	if (isSsrRequest && isMutatingRequest && (pathname === '/log-in' || pathname === '/register')) {
		const rateLimitConfig = resolveRateLimitConfig(pathname);
		if (rateLimitConfig) {
			const now = Date.now();
			const clientAddress = getClientAddress(event);
			const key = `${clientAddress}:${pathname}:${method}`;
			const result = consumeRateLimit(key, rateLimitConfig, now);
			if (!result.allowed) {
				const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
				const response = toPageErrorResponse(429, 'Too many requests. Please try again later.', {
					'retry-after': String(retryAfterSeconds)
				});
				logRequestSummary({
					scope: 'SSR',
					method,
					endpoint,
					table,
					recordCount: 0,
					status: 429,
					durationMs: nowMs() - startedAt,
					error: 'Rate limit exceeded'
				});
				return withSecurityHeaders(response, {
					requestId: event.locals.requestId,
					isApiRequest: false
				});
			}
		}
	}

	if (isApiRequest) {
		// Unknown API routes are blocked by policy map by default.
		const apiPolicy = getApiPolicy(pathname);
		if (!apiPolicy) {
			const response = toApiErrorResponse(
				403,
				event.locals.requestId,
				'API_FORBIDDEN',
				'This API endpoint is not available.'
			);

			logRequestSummary({
				scope: 'API',
				method,
				endpoint,
				table,
				recordCount: 0,
				status: 403,
				durationMs: nowMs() - startedAt,
				error: 'Endpoint blocked by API policy map'
			});

			return withSecurityHeaders(response, {
				requestId: event.locals.requestId,
				isApiRequest: true
			});
		}

		if (authHydrationError && apiPolicy.access !== 'public') {
			const response = toApiErrorResponse(
				500,
				event.locals.requestId,
				'AUTH_UNAVAILABLE',
				'Authentication is temporarily unavailable.'
			);

			logRequestSummary({
				scope: 'API',
				method,
				endpoint,
				table,
				recordCount: 0,
				status: 500,
				durationMs: nowMs() - startedAt,
				error: authHydrationError.message
			});

			return withSecurityHeaders(response, {
				requestId: event.locals.requestId,
				isApiRequest: true
			});
		}

		if (apiPolicy.access === 'authenticated' || apiPolicy.access === 'role') {
			if (!event.locals.user || !event.locals.session) {
				const response = toApiErrorResponse(
					401,
					event.locals.requestId,
					'AUTH_REQUIRED',
					'Authentication is required.'
				);

				logRequestSummary({
					scope: 'API',
					method,
					endpoint,
					table,
					recordCount: 0,
					status: 401,
					durationMs: nowMs() - startedAt,
					error: 'Missing authenticated session'
				});

				return withSecurityHeaders(response, {
					requestId: event.locals.requestId,
					isApiRequest: true
				});
			}
		}

		if (apiPolicy.access === 'role') {
			if (!hasAnyRole(event.locals.user?.role, apiPolicy.roles)) {
				const response = toApiErrorResponse(
					403,
					event.locals.requestId,
					'AUTH_FORBIDDEN',
					'You do not have permission to access this resource.'
				);

				logRequestSummary({
					scope: 'API',
					method,
					endpoint,
					table,
					recordCount: 0,
					status: 403,
					durationMs: nowMs() - startedAt,
					error: 'Role-based access denied'
				});

				return withSecurityHeaders(response, {
					requestId: event.locals.requestId,
					isApiRequest: true
				});
			}
		}

		const rateLimitConfig = resolveRateLimitConfig(pathname);
		if (rateLimitConfig) {
			const now = Date.now();
			const clientAddress = getClientAddress(event);
			const key = `${clientAddress}:${pathname}:${method}`;
			const result = consumeRateLimit(key, rateLimitConfig, now);
			if (!result.allowed) {
				const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
				const response = toApiErrorResponse(
					429,
					event.locals.requestId,
					'RATE_LIMITED',
					'Too many requests. Please try again later.',
					{
						'retry-after': String(retryAfterSeconds)
					}
				);
				logRequestSummary({
					scope: 'API',
					method,
					endpoint,
					table,
					recordCount: 0,
					status: 429,
					durationMs: nowMs() - startedAt,
					error: 'Rate limit exceeded'
				});
				return withSecurityHeaders(response, {
					requestId: event.locals.requestId,
					isApiRequest: true
				});
			}
		}
	}

	if (isSsrRequest) {
		// Protected pages require both valid session and allowed role.
		const protectedPage = isProtectedPagePath(pathname);
		if (protectedPage) {
			if (authHydrationError) {
				const response = toPageErrorResponse(500, 'Authentication is temporarily unavailable.');
				logRequestSummary({
					scope: 'SSR',
					method,
					endpoint,
					table,
					recordCount: 0,
					status: 500,
					durationMs: nowMs() - startedAt,
					error: authHydrationError.message
				});
				return withSecurityHeaders(response, {
					requestId: event.locals.requestId,
					isApiRequest: false
				});
			}

			if (!event.locals.user || !event.locals.session) {
				const loginTarget = `/log-in?next=${encodeURIComponent(`${pathname}${getSafeSearch(event.url)}`)}`;
				const response = toRedirectResponse(loginTarget, 303);
				logRequestSummary({
					scope: 'SSR',
					method,
					endpoint,
					table,
					recordCount: 0,
					status: 303,
					durationMs: nowMs() - startedAt,
					error: 'Redirected to login'
				});
				return withSecurityHeaders(response, {
					requestId: event.locals.requestId,
					isApiRequest: false
				});
			}

			if (!hasAnyRole(event.locals.user.role, DASHBOARD_ALLOWED_ROLES)) {
				const response = toPageErrorResponse(403, 'Forbidden');
				logRequestSummary({
					scope: 'SSR',
					method,
					endpoint,
					table,
					recordCount: 0,
					status: 403,
					durationMs: nowMs() - startedAt,
					error: 'Role-based access denied'
				});
				return withSecurityHeaders(response, {
					requestId: event.locals.requestId,
					isApiRequest: false
				});
			}
		}

		if (
			isAuthPagePath(pathname) &&
			event.locals.user &&
			hasAnyRole(event.locals.user.role, DASHBOARD_ALLOWED_ROLES)
		) {
			// Logged-in users should not stay on login/register pages.
			const nextParam = sanitizeNextPath(getSafeSearchParam(event.url, 'next'));
			const response = toRedirectResponse(nextParam ?? '/dashboard', 303);
			logRequestSummary({
				scope: 'SSR',
				method,
				endpoint,
				table,
				recordCount: 0,
				status: 303,
				durationMs: nowMs() - startedAt,
				error: 'Redirected authenticated user away from auth page'
			});
			return withSecurityHeaders(response, {
				requestId: event.locals.requestId,
				isApiRequest: false
			});
		}
	}

	try {
		let response = await resolve(event);
		const initialContentType = response.headers.get('content-type') ?? '';

		if (isApiRequest && response.status >= 400 && initialContentType.includes('application/json')) {
			try {
				const parsedErrorPayload = (await response.clone().json()) as unknown;
				if (
					parsedErrorPayload &&
					typeof parsedErrorPayload === 'object' &&
					!Array.isArray(parsedErrorPayload)
				) {
					const payload = parsedErrorPayload as Record<string, unknown>;
					const hasRequestId =
						typeof payload.requestId === 'string' && payload.requestId.trim().length > 0;
					if (!hasRequestId) {
						const headers = new Headers(response.headers);
						headers.delete('content-length');
						if (!headers.has('cache-control')) {
							headers.set('cache-control', 'no-store');
						}
						response = new Response(
							JSON.stringify({
								...payload,
								requestId: event.locals.requestId
							}),
							{
								status: response.status,
								statusText: response.statusText,
								headers
							}
						);
					}
				}
			} catch {
				// Ignore invalid JSON payloads from downstream handlers.
			}
		}

		if (
			!isApiRequest &&
			(isProtectedPagePath(pathname) || Boolean(event.locals.user && event.locals.session)) &&
			!response.headers.has('cache-control')
		) {
			const headers = new Headers(response.headers);
			headers.set('cache-control', 'no-store');
			response = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers
			});
		}

		const requestLogMeta = event.locals.requestLogMeta;
		const metaTable =
			typeof requestLogMeta?.table === 'string' && requestLogMeta.table.trim().length > 0
				? requestLogMeta.table.trim()
				: null;
		const metaRecordCount =
			typeof requestLogMeta?.recordCount === 'number' &&
			Number.isFinite(requestLogMeta.recordCount) &&
			requestLogMeta.recordCount >= 0
				? requestLogMeta.recordCount
				: null;
		let recordCount: number | null = response.status === 304 ? 0 : null;
		let errorMessage: string | null = null;
		const contentType = response.headers.get('content-type') ?? '';

		if (contentType.includes('application/json') && response.status !== 304) {
			try {
				const payload = (await response.clone().json()) as unknown;
				recordCount = getRecordCountFromPayload(payload);
				errorMessage = getErrorFromPayload(payload);
			} catch {
				recordCount = null;
			}
		}

		if (recordCount === null && response.status >= 400) {
			recordCount = 0;
		}

		if (metaRecordCount !== null) {
			recordCount = metaRecordCount;
		}

		if (recordCount === null && !isApiRequest && response.status < 400) {
			recordCount = 1;
		}

		logRequestSummary({
			scope,
			method,
			endpoint,
			table: metaTable ?? table,
			recordCount,
			status: response.status,
			durationMs: nowMs() - startedAt,
			error: errorMessage
		});

		return withSecurityHeaders(response, {
			requestId: event.locals.requestId,
			isApiRequest
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unhandled server error';
		logRequestSummary({
			scope,
			method,
			endpoint,
			table,
			recordCount: 0,
			status: 500,
			durationMs: nowMs() - startedAt,
			error: errorMessage
		});

		if (isApiRequest) {
			const status = error instanceof AuthServiceError ? error.status : 500;
			const code = error instanceof AuthServiceError ? error.code : 'INTERNAL_ERROR';
			const clientMessage =
				error instanceof AuthServiceError
					? error.clientMessage
					: 'An unexpected server error occurred.';
			const response = toApiErrorResponse(status, event.locals.requestId, code, clientMessage);
			return withSecurityHeaders(response, {
				requestId: event.locals.requestId,
				isApiRequest: true
			});
		}

		throw error;
	}
};
