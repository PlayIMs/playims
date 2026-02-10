import { DEFAULT_CLIENT, ensureDefaultClient } from '$lib/server/client-context';
import type { DatabaseOperations } from '$lib/database';
import type { RequestEvent } from '@sveltejs/kit';
import { AUTH_ENV_KEYS } from './constants';
import { hashPassword, normalizeIterations, verifyPassword } from './password';
import { createSessionForUser } from './session';

/**
 * Typed auth errors so API/UI can return safe messages and status codes
 * without leaking internals.
 */
export class AuthServiceError extends Error {
	public status: number;
	public code: string;
	public clientMessage: string;

	constructor(status: number, code: string, clientMessage: string) {
		super(code);
		this.status = status;
		this.code = code;
		this.clientMessage = clientMessage;
	}
}

const textEncoder = new TextEncoder();

const constantTimeStringEqual = (a: string, b: string): boolean => {
	const aBytes = textEncoder.encode(a);
	const bBytes = textEncoder.encode(b);
	if (aBytes.length !== bBytes.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < aBytes.length; i += 1) {
		result |= aBytes[i] ^ bBytes[i];
	}
	return result === 0;
};

const readAuthEnv = (event: RequestEvent, key: string): string | undefined => {
	// Cloudflare runtime first, Node process env as local fallback.
	const platformValue = (event.platform?.env as Record<string, unknown> | undefined)?.[key];
	if (typeof platformValue === 'string' && platformValue.trim().length > 0) {
		return platformValue.trim();
	}

	const nodeValue = process.env[key];
	if (typeof nodeValue === 'string' && nodeValue.trim().length > 0) {
		return nodeValue.trim();
	}

	return undefined;
};

/**
 * Required secret used for session token hashing and password peppering.
 */
export const requireSessionSecret = (event: RequestEvent): string => {
	const value = readAuthEnv(event, AUTH_ENV_KEYS.sessionSecret);
	if (!value) {
		throw new AuthServiceError(500, 'AUTH_CONFIG_MISSING', 'Authentication is not configured.');
	}
	return value;
};

const requireSignupInviteKey = (event: RequestEvent): string => {
	const value = readAuthEnv(event, AUTH_ENV_KEYS.signupInviteKey);
	if (!value) {
		throw new AuthServiceError(500, 'AUTH_CONFIG_MISSING', 'Authentication is not configured.');
	}
	return value;
};

const getPasswordIterations = (event: RequestEvent): number =>
	normalizeIterations(readAuthEnv(event, AUTH_ENV_KEYS.passwordIterations));

/**
 * Password login flow:
 * 1) look up user by normalized email
 * 2) verify password hash
 * 3) enforce active account
 * 4) create session + cookie
 */
export const loginWithPassword = async (
	event: RequestEvent,
	dbOps: DatabaseOperations,
	input: {
		email: string;
		password: string;
	}
) => {
	const sessionSecret = requireSessionSecret(event);
	const normalizedEmail = input.email.trim().toLowerCase();
	const existingUser = await dbOps.users.getAuthByEmail(normalizedEmail);
	if (!existingUser || !existingUser.passwordHash) {
		throw new AuthServiceError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
	}

	const verified = await verifyPassword({
		password: input.password,
		pepper: sessionSecret,
		storedHash: existingUser.passwordHash
	});
	if (!verified) {
		throw new AuthServiceError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
	}

	if (existingUser.status !== 'active') {
		throw new AuthServiceError(403, 'AUTH_ACCOUNT_INACTIVE', 'Your account is not active.');
	}

	const loginMarkedUser = await dbOps.users.markLoginSuccess(existingUser.id);
	const userForSession = loginMarkedUser ?? existingUser;
	return await createSessionForUser(event, dbOps, userForSession, sessionSecret);
};

/**
 * Invite-key registration flow for this phase.
 * New users are attached to DEFAULT_CLIENT and granted admin role.
 */
export const registerWithPassword = async (
	event: RequestEvent,
	dbOps: DatabaseOperations,
	input: {
		email: string;
		password: string;
		inviteKey: string;
		firstName?: string;
		lastName?: string;
	}
) => {
	const sessionSecret = requireSessionSecret(event);
	const expectedInviteKey = requireSignupInviteKey(event);
	const providedInviteKey = input.inviteKey.trim();

	if (!constantTimeStringEqual(expectedInviteKey, providedInviteKey)) {
		throw new AuthServiceError(403, 'AUTH_INVALID_INVITE_KEY', 'Invalid invite key.');
	}

	await ensureDefaultClient(dbOps);

	const normalizedEmail = input.email.trim().toLowerCase();
	const existingUser = await dbOps.users.getAuthByEmail(normalizedEmail);
	if (existingUser) {
		throw new AuthServiceError(409, 'AUTH_ACCOUNT_EXISTS', 'An account with that email already exists.');
	}

	const passwordHash = await hashPassword({
		password: input.password,
		pepper: sessionSecret,
		iterations: getPasswordIterations(event)
	});

	const createdUser = await dbOps.users.createAuthUser({
		clientId: DEFAULT_CLIENT.id,
		email: normalizedEmail,
		passwordHash,
		role: 'admin',
		firstName: input.firstName?.trim() || null,
		lastName: input.lastName?.trim() || null,
		status: 'active'
	});

	if (!createdUser) {
		throw new AuthServiceError(500, 'AUTH_CREATE_FAILED', 'Failed to create your account.');
	}

	const loginMarkedUser = await dbOps.users.markLoginSuccess(createdUser.id);
	const userForSession = loginMarkedUser ?? createdUser;
	return await createSessionForUser(event, dbOps, userForSession, sessionSecret);
};
