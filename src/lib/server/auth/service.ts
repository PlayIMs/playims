import { DEFAULT_CLIENT, ensureDefaultClient } from '$lib/server/client-context';
import type { DatabaseOperations } from '$lib/database';
import type { RequestEvent } from '@sveltejs/kit';
import { AUTH_ENV_KEYS, AUTH_PBKDF2_DEFAULT_ITERATIONS } from './constants';
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
const DUMMY_PASSWORD_HASH = `pbkdf2_sha256$${AUTH_PBKDF2_DEFAULT_ITERATIONS}$AAECAwQFBgcICQoLDA0ODw$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
let hasWarnedPasswordPepperFallback = false;

const constantTimeStringEqual = (a: string, b: string): boolean => {
	const aBytes = textEncoder.encode(a);
	const bBytes = textEncoder.encode(b);

	const maxLength = Math.max(aBytes.length, bBytes.length);
	let result = aBytes.length ^ bBytes.length;
	for (let i = 0; i < maxLength; i += 1) {
		const aByte = i < aBytes.length ? aBytes[i] : 0;
		const bByte = i < bBytes.length ? bBytes[i] : 0;
		result |= aByte ^ bByte;
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
 * Required secret used for session token hashing.
 */
export const requireSessionSecret = (event: RequestEvent): string => {
	const value = readAuthEnv(event, AUTH_ENV_KEYS.sessionSecret);
	if (!value) {
		throw new AuthServiceError(500, 'AUTH_CONFIG_MISSING', 'Authentication is not configured.');
	}
	return value;
};

/**
 * Password pepper is split from session secret.
 * Temporary fallback keeps compatibility while environments rotate to AUTH_PASSWORD_PEPPER.
 */
export const resolvePasswordPepper = (event: RequestEvent): string => {
	const pepper = readAuthEnv(event, AUTH_ENV_KEYS.passwordPepper);
	if (pepper) {
		return pepper;
	}

	const fallback = requireSessionSecret(event);
	if (!hasWarnedPasswordPepperFallback) {
		hasWarnedPasswordPepperFallback = true;
		console.warn(
			'[auth] AUTH_PASSWORD_PEPPER is not configured; falling back to AUTH_SESSION_SECRET. Configure AUTH_PASSWORD_PEPPER to complete rotation.'
		);
	}

	return fallback;
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

const throwRegistrationDenied = (): never => {
	throw new AuthServiceError(
		403,
		'AUTH_REGISTRATION_DENIED',
		'Unable to register with the provided credentials.'
	);
};

const resolveLoginMembership = async (dbOps: DatabaseOperations, user: { id: string; clientId: string | null; role: string | null; status: string | null; }) => {
	const legacyClientId = user.clientId?.trim();
	if (legacyClientId) {
		await dbOps.userClients.ensureMembership({
			userId: user.id,
			clientId: legacyClientId,
			role: user.role ?? 'player',
			status: user.status ?? 'active',
			isDefault: true
		});
	}

	const defaultMembership = await dbOps.userClients.getDefaultActiveForUser(user.id);
	if (defaultMembership) {
		return defaultMembership;
	}

	const fallbackMembership = await dbOps.userClients.getFirstActiveForUser(user.id);
	if (fallbackMembership) {
		return fallbackMembership;
	}

	throw new AuthServiceError(
		403,
		'AUTH_ACCOUNT_UNASSIGNED',
		'Your account is not assigned to an organization.'
	);
};

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
	const passwordPepper = resolvePasswordPepper(event);
	const normalizedEmail = input.email.trim().toLowerCase();
	const existingUser = await dbOps.users.getAuthByEmail(normalizedEmail);
	if (!existingUser || !existingUser.passwordHash) {
		// Keep per-request timing closer to "real" verification to reduce user-enumeration signals.
		await verifyPassword({
			password: input.password,
			pepper: passwordPepper,
			storedHash: DUMMY_PASSWORD_HASH
		});
		throw new AuthServiceError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
	}

	const verified = await verifyPassword({
		password: input.password,
		pepper: passwordPepper,
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
	const membership = await resolveLoginMembership(dbOps, userForSession);
	return await createSessionForUser(event, dbOps, userForSession, sessionSecret, {
		activeClientId: membership.clientId,
		activeRole: membership.role
	});
};

/**
 * Invite-key registration flow for this phase.
 * New users are attached to DEFAULT_CLIENT with least-privilege role.
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
	const passwordPepper = resolvePasswordPepper(event);
	const expectedInviteKey = requireSignupInviteKey(event);
	const providedInviteKey = input.inviteKey.trim();

	if (!constantTimeStringEqual(expectedInviteKey, providedInviteKey)) {
		throwRegistrationDenied();
	}

	await ensureDefaultClient(dbOps);

	const normalizedEmail = input.email.trim().toLowerCase();
	const existingUser = await dbOps.users.getAuthByEmail(normalizedEmail);
	if (existingUser) {
		throwRegistrationDenied();
	}

	const passwordHash = await hashPassword({
		password: input.password,
		pepper: passwordPepper,
		iterations: getPasswordIterations(event)
	});

	let createdUser: Awaited<ReturnType<typeof dbOps.users.createAuthUser>> | null = null;
	try {
		createdUser = await dbOps.users.createAuthUser({
			clientId: DEFAULT_CLIENT.id,
			email: normalizedEmail,
			passwordHash,
			role: 'manager',
			firstName: input.firstName?.trim() || null,
			lastName: input.lastName?.trim() || null,
			status: 'active'
		});
	} catch {
		throwRegistrationDenied();
	}

	if (!createdUser) {
		throw new AuthServiceError(500, 'AUTH_CREATE_FAILED', 'Failed to create your account.');
	}

	await dbOps.userClients.ensureMembership({
		userId: createdUser.id,
		clientId: DEFAULT_CLIENT.id,
		role: 'manager',
		status: 'active',
		isDefault: true
	});

	const loginMarkedUser = await dbOps.users.markLoginSuccess(createdUser.id);
	const userForSession = loginMarkedUser ?? createdUser;
	return await createSessionForUser(event, dbOps, userForSession, sessionSecret, {
		activeClientId: DEFAULT_CLIENT.id,
		activeRole: 'manager'
	});
};
