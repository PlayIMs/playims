/*
Brief description:
This file verifies the thin API route wrappers around login, registration, and logout.

Deeper explanation:
The auth service already has focused tests, but the route wrappers still decide how malformed requests,
local-development login shortcuts, service errors, and logout responses are exposed over HTTP. These
tests protect that API contract directly so future refactors do not accidentally change status codes
or bypass the intended branch selection.

Summary of tests:
1. It verifies that login rejects malformed JSON payloads.
2. It verifies that login uses the local-development branch when the special credential pair is detected.
3. It verifies that login maps service-layer auth errors into safe API responses.
4. It verifies that registration rejects invalid payloads before calling the auth service.
5. It verifies that registration maps service-layer auth errors into safe API responses.
6. It verifies that logout fails cleanly when the database binding is unavailable.
7. It verifies that logout revokes the current session and returns a logged-out response.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks let the route modules capture fake auth helpers during import.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			sessions: {}
		},
		getCentralDbOps: vi.fn(),
		isLocalDevCredentialPair: vi.fn(),
		loginWithLocalDevCredentials: vi.fn(),
		loginWithPassword: vi.fn(),
		registerWithPassword: vi.fn(),
		revokeCurrentSession: vi.fn()
	};
});

// the route modules still execute their real branching logic, but the side-effect helpers are mocked.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

vi.mock('$lib/server/auth/local-dev', () => ({
	isLocalDevCredentialPair: mocks.isLocalDevCredentialPair
}));

vi.mock('$lib/server/auth/service', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/auth/service')>(
		'$lib/server/auth/service'
	);
	return {
		...actual,
		loginWithLocalDevCredentials: mocks.loginWithLocalDevCredentials,
		loginWithPassword: mocks.loginWithPassword,
		registerWithPassword: mocks.registerWithPassword
	};
});

vi.mock('$lib/server/auth/session', () => ({
	revokeCurrentSession: mocks.revokeCurrentSession
}));

import { AuthServiceError } from '../../src/lib/server/auth/service';
import { POST as login } from '../../src/routes/api/auth/login/+server';
import { POST as logout } from '../../src/routes/api/auth/logout/+server';
import { POST as register } from '../../src/routes/api/auth/register/+server';

// this helper builds a minimal sveltekit request event for the auth route wrappers.
const createEvent = (input?: {
	path?: string;
	body?: unknown;
	request?: Request;
	withDb?: boolean;
	locals?: Record<string, unknown>;
}) => {
	const path = input?.path ?? '/api/auth/login';
	const url = new URL(`https://playims.test${path}`);
	const request =
		input?.request ??
		new Request(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: input?.body !== undefined ? JSON.stringify(input.body) : undefined
		});

	return {
		url,
		request,
		platform: input?.withDb === false ? { env: {} } : { env: { DB: {} } },
		locals:
			input?.locals ??
			({
				user: {
					id: 'user-1',
					clientId: 'client-1',
					role: 'manager'
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					clientId: 'client-1',
					activeClientId: 'client-1',
					role: 'manager'
				}
			} as Record<string, unknown>)
	} as any;
};

describe('auth route wrappers', () => {
	beforeEach(() => {
		// clean call history keeps each wrapper test independent and easy to read.
		vi.clearAllMocks();
		mocks.isLocalDevCredentialPair.mockReturnValue(false);
		mocks.loginWithLocalDevCredentials.mockResolvedValue({
			session: { id: 'session-1' }
		});
		mocks.loginWithPassword.mockResolvedValue({
			session: { id: 'session-2' }
		});
		mocks.registerWithPassword.mockResolvedValue({
			session: { id: 'session-3' }
		});
		mocks.revokeCurrentSession.mockResolvedValue(undefined);
	});

	it('rejects malformed login JSON payloads', async () => {
		// broken json should fail before the route attempts any auth branch selection.
		const event = createEvent({
			request: new Request('https://playims.test/api/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{'
			})
		});

		const response = await login(event);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe('Invalid request payload.');
		expect(mocks.loginWithPassword).not.toHaveBeenCalled();
	});

	it('uses the local-development login branch when the special credentials are detected', async () => {
		// forcing the local-dev predicate true proves the route skips normal schema login handling.
		mocks.isLocalDevCredentialPair.mockReturnValue(true);
		mocks.loginWithLocalDevCredentials.mockResolvedValue({
			session: { id: 'dev-session-1' },
			user: { id: 'user-1' }
		});

		const response = await login(
			createEvent({
				body: {
					email: 'dev',
					password: 'dev'
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(mocks.loginWithLocalDevCredentials).toHaveBeenCalledTimes(1);
		expect(mocks.loginWithPassword).not.toHaveBeenCalled();
	});

	it('maps password-login auth errors into safe api responses', async () => {
		// the route should forward the service status, safe message, and error code without leaking internals.
		mocks.loginWithPassword.mockRejectedValue(
			new AuthServiceError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.')
		);

		const response = await login(
			createEvent({
				body: {
					email: 'user@playims.test',
					password: 'StrongPass123'
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(401);
		expect(payload.error).toBe('Invalid email or password.');
		expect(payload.code).toBe('AUTH_INVALID_CREDENTIALS');
	});

	it('rejects invalid registration payloads before calling the auth service', async () => {
		// mismatched passwords should be stopped by schema validation before registration logic runs.
		const response = await register(
			createEvent({
				path: '/api/auth/register',
				body: {
					email: 'new@playims.test',
					password: 'StrongPass123',
					confirmPassword: 'DifferentPass123',
					inviteKey: 'invite-key'
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe('Invalid request payload.');
		expect(mocks.registerWithPassword).not.toHaveBeenCalled();
	});

	it('maps registration auth errors into safe api responses', async () => {
		// this protects the route wrapper from collapsing all registration failures into a generic 500.
		mocks.registerWithPassword.mockRejectedValue(
			new AuthServiceError(
				409,
				'AUTH_EMAIL_ALREADY_REGISTERED',
				'An account with this email already exists. Please sign in instead.'
			)
		);

		const response = await register(
			createEvent({
				path: '/api/auth/register',
				body: {
					email: 'new@playims.test',
					password: 'StrongPass123',
					confirmPassword: 'StrongPass123',
					inviteKey: 'invite-key'
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('An account with this email already exists. Please sign in instead.');
		expect(payload.code).toBe('AUTH_EMAIL_ALREADY_REGISTERED');
	});

	it('returns a server error for logout when the database binding is unavailable', async () => {
		// logout needs the central database to revoke the current session safely.
		const response = await logout(
			createEvent({
				path: '/api/auth/logout',
				withDb: false
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(payload.error).toBe('Authentication is unavailable.');
		expect(mocks.revokeCurrentSession).not.toHaveBeenCalled();
	});

	it('revokes the current session and returns a logged-out response', async () => {
		// this is the happy path where the wrapper should only coordinate the revoke helper and response shape.
		const event = createEvent({
			path: '/api/auth/logout'
		});
		const response = await logout(event);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			data: {
				loggedOut: true
			}
		});
		expect(mocks.revokeCurrentSession).toHaveBeenCalledWith(event, mocks.dbOps);
	});
});
