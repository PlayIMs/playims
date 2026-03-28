/*
Brief description:
This file verifies the dedicated first-login password setup flow.

Deeper explanation:
Temporary-password accounts should be funneled into a focused password setup step before they can use
the rest of the app. These tests protect the routing guard that sends users there, the no-loop behavior
for the setup page itself, and the password update action that clears the forced-change flag before
continuing into the app.

Summary of tests:
1. It verifies that protected dashboard routes redirect temporary-password users to the dedicated setup page.
2. It verifies that the setup page itself is allowed through the hook so users are not trapped in a redirect loop.
3. It verifies that authenticated users who revisit the login page are redirected to the setup page instead of the dashboard.
4. It verifies that submitting a new password clears the forced-change flag and redirects to the intended next page.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	dbOps: {
		users: {
			getAuthByIdForClient: vi.fn(),
			updateSelfPasswordHash: vi.fn()
		},
		sessions: {
			revokeAllForUserExceptSessionInClient: vi.fn(),
			revokeById: vi.fn()
		}
	},
	getCentralDbOps: vi.fn(),
	hashPassword: vi.fn(),
	revokeCurrentSession: vi.fn()
}));

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

vi.mock('$lib/server/auth/password', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/auth/password')>(
		'$lib/server/auth/password'
	);
	return {
		...actual,
		hashPassword: mocks.hashPassword
	};
});

vi.mock('$lib/server/auth/session', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/auth/session')>(
		'$lib/server/auth/session'
	);
	return {
		...actual,
		revokeCurrentSession: mocks.revokeCurrentSession
	};
});

import { handle } from '../../src/hooks.server';
import { actions } from '../../src/routes/set-password/+page.server';

const createCookies = () => {
	// this minimal cookie jar is enough for redirect-focused hook coverage.
	const jar = new Map<string, string>();
	return {
		get: (name: string) => jar.get(name),
		set: (name: string, value: string) => {
			jar.set(name, value);
		},
		delete: (name: string) => {
			jar.delete(name);
		}
	};
};

// this helper creates an authenticated temporary-password user for route-guard tests.
const createHookEvent = (pathname: string) =>
	({
		url: new URL(`https://playims.test${pathname}`),
		request: new Request(`https://playims.test${pathname}`, { method: 'GET' }),
		cookies: createCookies(),
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role: 'manager',
				baseRole: 'manager',
				mustChangePassword: true
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role: 'manager',
				baseRole: 'manager',
				authProvider: 'password',
				expiresAt: new Date(Date.now() + 60_000).toISOString()
			}
		},
		getClientAddress: () => '198.51.100.90',
		platform: { env: {} }
	}) as any;

describe('must-change-password enforcement', () => {
	beforeEach(() => {
		// these defaults keep each test focused on the routing or happy-path setup behavior it cares about.
		vi.clearAllMocks();
		mocks.hashPassword.mockResolvedValue('new-password-hash');
		mocks.dbOps.users.getAuthByIdForClient.mockResolvedValue({
			id: 'user-1',
			email: 'jamie@playims.test',
			passwordHash: 'stored-password-hash',
			status: 'active',
			mustChangePassword: 1
		});
		mocks.dbOps.users.updateSelfPasswordHash.mockResolvedValue({
			id: 'user-1',
			email: 'jamie@playims.test',
			passwordHash: 'new-password-hash',
			status: 'active',
			mustChangePassword: 0
		});
		mocks.dbOps.sessions.revokeAllForUserExceptSessionInClient.mockResolvedValue(undefined);
		mocks.revokeCurrentSession.mockResolvedValue(undefined);
	});

	it('redirects protected dashboard routes to the dedicated setup page', async () => {
		// the next query keeps the user headed back to the page they originally wanted once setup is done.
		const response = await handle({
			event: createHookEvent('/dashboard/members'),
			resolve: async () => new Response('<html>members</html>', { status: 200 })
		});

		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('/set-password?next=%2Fdashboard%2Fmembers');
	});

	it('allows the dedicated setup page through the hook without a redirect loop', async () => {
		// this proves the hook exempts the one route the user needs in order to unblock themselves.
		const response = await handle({
			event: createHookEvent('/set-password?next=%2Fdashboard%2Fmembers'),
			resolve: async () => new Response('<html>setup</html>', { status: 200 })
		});

		expect(response.status).toBe(200);
	});

	it('redirects authenticated temporary-password users away from the login page to the setup page', async () => {
		// revisiting /log-in after authenticating should still keep the user inside the required setup flow.
		const response = await handle({
			event: createHookEvent('/log-in?next=%2Fdashboard%2Fmembers'),
			resolve: async () => new Response('<html>login</html>', { status: 200 })
		});

		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('/set-password?next=%2Fdashboard%2Fmembers');
	});

	it('clears the forced password-change flag and redirects to the requested page', async () => {
		// the user is already authenticated here, so the setup form only needs the new password pair.
		const event = {
			platform: {
				env: {
					DB: {},
					AUTH_PASSWORD_PEPPER: 'pepper-secret',
					AUTH_PASSWORD_PBKDF2_ITERATIONS: '210000'
				}
			},
			locals: {
				user: {
					id: 'user-1',
					clientId: 'client-1',
					role: 'manager',
					baseRole: 'manager',
					mustChangePassword: true
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					clientId: 'client-1',
					activeClientId: 'client-1',
					role: 'manager',
					baseRole: 'manager',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/set-password', {
				method: 'POST',
				body: new URLSearchParams({
					next: '/dashboard/members',
					newPassword: 'BetterPass123!',
					confirmPassword: 'BetterPass123!'
				})
			})
		} as any;

		try {
			await actions.setPassword(event);
			throw new Error('expected redirect');
		} catch (error) {
			expect(error).toMatchObject({
				status: 303,
				location: '/dashboard/members'
			});
		}

		expect(mocks.dbOps.users.updateSelfPasswordHash).toHaveBeenCalledWith({
			userId: 'user-1',
			clientId: 'client-1',
			passwordHash: 'new-password-hash',
			updatedUser: 'user-1',
			mustChangePassword: false
		});
		expect(mocks.dbOps.sessions.revokeAllForUserExceptSessionInClient).toHaveBeenCalledWith(
			'user-1',
			'client-1',
			'session-1'
		);
		expect(event.locals.user.mustChangePassword).toBe(false);
	});
});
