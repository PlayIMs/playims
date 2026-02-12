import { dev } from '$app/environment';
import type { DatabaseOperations } from '$lib/database';
import type { User } from '$lib/database/schema/users';
import type { RequestEvent } from '@sveltejs/kit';
import {
	AUTH_PASSWORD_PROVIDER,
	AUTH_SESSION_ABSOLUTE_TTL_MS,
	AUTH_SESSION_COOKIE_NAME,
	AUTH_SESSION_RENEW_WINDOW_MS,
	AUTH_SESSION_TTL_MS,
	AUTH_SESSION_TTL_SECONDS
} from './constants';
import { normalizeRole } from './rbac';

/**
 * Session helper module.
 *
 * Design goals:
 * 1. Keep browser cookie opaque (random token only).
 * 2. Store only hashed token server-side.
 * 3. Enforce expiration + sliding renewal from one place.
 */
const textEncoder = new TextEncoder();

const bytesToBinary = (bytes: Uint8Array): string => {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i]);
	}
	return binary;
};

const toBase64Url = (bytes: Uint8Array): string =>
	btoa(bytesToBinary(bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');

const toHex = (bytes: Uint8Array): string =>
	Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');

const toIsoWithOffset = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const toAbsoluteSessionExpiryMs = (createdAt: string) => {
	const createdAtMs = Date.parse(createdAt);
	if (!Number.isFinite(createdAtMs)) {
		return null;
	}

	return createdAtMs + AUTH_SESSION_ABSOLUTE_TTL_MS;
};

const resolveCookieSecure = (event: RequestEvent) => {
	if (dev) {
		return false;
	}

	return event.url.protocol === 'https:';
};

const getCookieOptions = (event: RequestEvent) => ({
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: resolveCookieSecure(event),
	maxAge: AUTH_SESSION_TTL_SECONDS
});

/**
 * Writes the session cookie. Raw token never leaves cookie storage.
 */
export const setSessionCookie = (event: RequestEvent, token: string) => {
	event.cookies.set(AUTH_SESSION_COOKIE_NAME, token, getCookieOptions(event));
};

/**
 * Removes the session cookie from browser storage.
 */
export const clearSessionCookie = (event: RequestEvent) => {
	event.cookies.delete(AUTH_SESSION_COOKIE_NAME, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: resolveCookieSecure(event)
	});
};

/**
 * Creates a cryptographically random opaque token for the cookie.
 */
export const generateSessionToken = () => {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return toBase64Url(bytes);
};

/**
 * Hashes the opaque token with HMAC so DB never stores raw session tokens.
 */
export const hashSessionToken = async (token: string, sessionSecret: string): Promise<string> => {
	const key = await crypto.subtle.importKey(
		'raw',
		textEncoder.encode(sessionSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(token));
	return toHex(new Uint8Array(signature));
};

const getClientAddress = (event: RequestEvent) => {
	try {
		return event.getClientAddress();
	} catch {
		const cfAddress = event.request.headers.get('cf-connecting-ip');
		if (cfAddress && cfAddress.trim().length > 0) {
			return cfAddress.trim();
		}
		const forwardedAddress = event.request.headers.get('x-forwarded-for');
		if (forwardedAddress && forwardedAddress.trim().length > 0) {
			return forwardedAddress.split(',')[0].trim();
		}
		return null;
	}
};

export const buildSafeUser = (user: User) => ({
	id: user.id,
	clientId: user.clientId ?? '',
	email: user.email ?? '',
	firstName: user.firstName ?? null,
	lastName: user.lastName ?? null,
	cellPhone: user.cellPhone ?? null,
	role: normalizeRole(user.role),
	status: user.status ?? null
});

const buildSafeUserWithContext = (
	user: User,
	context: {
		activeClientId: string;
		activeRole: string | null | undefined;
	}
) => ({
	id: user.id,
	clientId: context.activeClientId,
	email: user.email ?? '',
	firstName: user.firstName ?? null,
	lastName: user.lastName ?? null,
	cellPhone: user.cellPhone ?? null,
	role: normalizeRole(context.activeRole),
	status: user.status ?? null
});

/**
 * Creates a DB session row + cookie for a validated user login/register flow.
 */
export const createSessionForUser = async (
	event: RequestEvent,
	dbOps: DatabaseOperations,
	user: User,
	sessionSecret: string,
	context?: {
		activeClientId: string;
		activeRole?: string | null;
	}
) => {
	const clientId = context?.activeClientId?.trim() ?? user.clientId?.trim();
	if (!clientId) {
		throw new Error('AUTH_USER_MISSING_CLIENT');
	}

	const token = generateSessionToken();
	const tokenHash = await hashSessionToken(token, sessionSecret);
	const nowIso = new Date().toISOString();
	const expiresAt = toIsoWithOffset(AUTH_SESSION_TTL_MS);
	const createdSession = await dbOps.sessions.create({
		userId: user.id,
		clientId,
		tokenHash,
		authProvider: AUTH_PASSWORD_PROVIDER,
		expiresAt,
		lastSeenAt: nowIso,
		ipAddress: getClientAddress(event),
		userAgent: event.request.headers.get('user-agent')
	});

	if (!createdSession) {
		throw new Error('AUTH_SESSION_CREATE_FAILED');
	}

	setSessionCookie(event, token);

	return {
		session: {
			id: createdSession.id,
			userId: user.id,
			clientId,
			activeClientId: clientId,
			role: normalizeRole(context?.activeRole ?? user.role),
			authProvider: createdSession.authProvider ?? AUTH_PASSWORD_PROVIDER,
			expiresAt: createdSession.expiresAt
		},
		user: buildSafeUserWithContext(user, {
			activeClientId: clientId,
			activeRole: context?.activeRole ?? user.role
		})
	};
};

/**
 * Resolves session from cookie token, validates expiry/account state, and
 * renews near-expiry sessions (sliding 24h behavior).
 */
export const resolveSessionFromRequest = async (
	event: RequestEvent,
	dbOps: DatabaseOperations,
	sessionSecret: string
) => {
	const rawToken = event.cookies.get(AUTH_SESSION_COOKIE_NAME);
	if (!rawToken) {
		return null;
	}

	const tokenHash = await hashSessionToken(rawToken, sessionSecret);
	const nowIso = new Date().toISOString();
	const found = await dbOps.sessions.findValidByTokenHash(tokenHash, nowIso);
	if (!found) {
		clearSessionCookie(event);
		return null;
	}

	const clientId = found.session.clientId?.trim();
	if (!clientId || found.user.status !== 'active') {
		await dbOps.sessions.revokeById(found.session.id);
		clearSessionCookie(event);
		return null;
	}

	const activeMembership = await dbOps.userClients.getActiveMembership(found.user.id, clientId);
	if (!activeMembership) {
		await dbOps.sessions.revokeById(found.session.id);
		clearSessionCookie(event);
		return null;
	}

	const nowMs = Date.now();
	const absoluteExpiryMs = toAbsoluteSessionExpiryMs(found.session.createdAt);
	if (absoluteExpiryMs === null || absoluteExpiryMs <= nowMs) {
		await dbOps.sessions.revokeById(found.session.id);
		clearSessionCookie(event);
		return null;
	}

	const expiresAtMs = Date.parse(found.session.expiresAt);
	if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
		await dbOps.sessions.revokeById(found.session.id);
		clearSessionCookie(event);
		return null;
	}

	const shouldExtend = expiresAtMs - nowMs <= AUTH_SESSION_RENEW_WINDOW_MS;
	let effectiveExpiresAt = found.session.expiresAt;

	if (shouldExtend) {
		const nextExpiresAtMs = Math.min(nowMs + AUTH_SESSION_TTL_MS, absoluteExpiryMs);
		const nextExpiresAt = new Date(nextExpiresAtMs).toISOString();
		const extended = await dbOps.sessions.extend(found.session.id, {
			expiresAt: nextExpiresAt,
			lastSeenAt: new Date(nowMs).toISOString()
		});
		if (extended) {
			effectiveExpiresAt = extended.expiresAt;
		}
		setSessionCookie(event, rawToken);
	}

	await dbOps.users.touchLastActive(found.user.id);

	return {
		session: {
			id: found.session.id,
			userId: found.user.id,
			clientId,
			activeClientId: clientId,
			role: normalizeRole(activeMembership.role),
			authProvider: found.session.authProvider ?? AUTH_PASSWORD_PROVIDER,
			expiresAt: effectiveExpiresAt
		},
		user: buildSafeUserWithContext(found.user, {
			activeClientId: clientId,
			activeRole: activeMembership.role
		})
	};
};

/**
 * Server-side logout helper: revoke current session and clear cookie.
 */
export const revokeCurrentSession = async (event: RequestEvent, dbOps: DatabaseOperations) => {
	if (event.locals.session?.id) {
		await dbOps.sessions.revokeById(event.locals.session.id);
	}
	clearSessionCookie(event);
	event.locals.session = undefined;
	event.locals.user = undefined;
};
