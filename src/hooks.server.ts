import { dev } from '$app/environment';
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

type RateLimitConfig = {
	windowMs: number;
	maxRequests: number;
};

const API_PUBLIC_ALLOWLIST: RegExp[] = [
	/^\/api\/address-suggest$/,
	/^\/api\/themes$/,
	/^\/api\/themes\/current$/,
	/^\/api\/themes\/[^/]+$/
];

const ADDRESS_SUGGEST_RATE_LIMIT: RateLimitConfig = {
	windowMs: 60_000,
	maxRequests: 60
};

const THEMES_RATE_LIMIT: RateLimitConfig = {
	windowMs: 60_000,
	maxRequests: 120
};

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
let lastRateLimitCleanupAt = 0;

const resolveRateLimitConfig = (pathname: string): RateLimitConfig | null => {
	if (pathname === '/api/address-suggest') {
		return ADDRESS_SUGGEST_RATE_LIMIT;
	}
	if (pathname === '/api/themes' || pathname.startsWith('/api/themes/')) {
		return THEMES_RATE_LIMIT;
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

const isAllowedPublicApiPath = (pathname: string) =>
	API_PUBLIC_ALLOWLIST.some((pattern) => pattern.test(pathname));

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

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};

export const handle: Handle = async ({ event, resolve }) => {
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

	if (!isApiRequest && !isSsrRequest) {
		const response = await resolve(event);
		return withSecurityHeaders(response, {
			requestId: event.locals.requestId,
			isApiRequest: false
		});
	}

	const startedAt = nowMs();
	const method = event.request.method;
	const endpoint = `${event.url.pathname}${event.url.search}`;
	const table = isApiRequest ? getApiTableFromPath(pathname) : getSsrTableFromPath(pathname);
	const scope = isApiRequest ? 'API' : 'SSR';

	if (isApiRequest && !isAllowedPublicApiPath(pathname)) {
		const response = toApiErrorResponse(
			403,
			event.locals.requestId,
			'API_FORBIDDEN',
			'This API endpoint is not available in the current security mode.'
		);
		logRequestSummary({
			scope: 'API',
			method,
			endpoint,
			table,
			recordCount: 0,
			status: 403,
			durationMs: nowMs() - startedAt,
			error: 'Endpoint blocked by API allowlist'
		});
		return withSecurityHeaders(response, {
			requestId: event.locals.requestId,
			isApiRequest: true
		});
	}

	if (isApiRequest) {
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
				// Ignore invalid JSON bodies from downstream handlers.
			}
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
			const response = toApiErrorResponse(
				500,
				event.locals.requestId,
				'INTERNAL_ERROR',
				'An unexpected server error occurred.'
			);
			return withSecurityHeaders(response, {
				requestId: event.locals.requestId,
				isApiRequest: true
			});
		}

		throw error;
	}
};
