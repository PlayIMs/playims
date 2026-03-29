/*
Brief description:
This file verifies how password login chooses the active client context for multi-client users.

Deeper explanation:
A user can belong to more than one organization, so login has to do more than verify a password. It
must also choose the correct active membership before session creation. This test protects that handoff
so a future auth refactor does not drop the default-membership preference.

Summary of tests:
1. It verifies that password login uses the default active membership for session client context.
2. It verifies that temporary-password accounts can still create a session before the forced-change guard redirects them.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as sessionModule from '../../src/lib/server/auth/session';
import { hashPassword } from '../../src/lib/server/auth/password';
import { loginWithPassword } from '../../src/lib/server/auth/service';

describe('multi-client login behavior', () => {
	beforeEach(() => {
		// restoring spies keeps this auth-focused test isolated from earlier session mocks.
		vi.restoreAllMocks();
	});

	it('chooses default active membership for session client context', async () => {
		// a real password hash keeps the test aligned with the actual password verification path.
		const pepper = 'pepper-secret';
		const sessionSecret = 'session-secret';
		const password = 'StrongPass123';
		const storedHash = await hashPassword({
			password,
			pepper,
			iterations: 210_000
		});

		const createSessionSpy = vi.spyOn(sessionModule, 'createSessionForUser').mockResolvedValue({
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: '33333333-3333-4333-8333-333333333333',
				activeClientId: '33333333-3333-4333-8333-333333333333',
				role: 'manager',
				authProvider: 'password',
				expiresAt: new Date().toISOString()
			},
			user: {
				id: 'user-1',
				clientId: '33333333-3333-4333-8333-333333333333',
				role: 'manager'
			}
		} as any);

		// the user record belongs to one client, but the default membership points at another.
		// that mismatch is the key behavior this test exists to protect.
		const dbOps = {
			users: {
				getAuthByEmail: vi.fn().mockResolvedValue({
					id: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					email: 'user@playims.com',
					passwordHash: storedHash,
					status: 'active',
					role: 'participant'
				}),
				markLoginSuccess: vi.fn().mockResolvedValue(null)
			},
			userClients: {
				ensureMembership: vi.fn().mockResolvedValue(null),
				getDefaultActiveForUser: vi.fn().mockResolvedValue({
					userId: 'user-1',
					clientId: '33333333-3333-4333-8333-333333333333',
					role: 'manager',
					status: 'active'
				}),
				getFirstActiveForUser: vi.fn().mockResolvedValue(null)
			}
		} as any;

		const event = {
			platform: {
				env: {
					AUTH_SESSION_SECRET: sessionSecret,
					AUTH_PASSWORD_PEPPER: pepper
				}
			}
		} as any;

		await loginWithPassword(event, dbOps, {
			email: 'user@playims.com',
			password
		});

		// these assertions prove the chosen active client comes from membership state, not the auth row.
		expect(dbOps.userClients.getDefaultActiveForUser).toHaveBeenCalledWith('user-1');
		expect(createSessionSpy).toHaveBeenCalledWith(
			event,
			dbOps,
			expect.any(Object),
			sessionSecret,
			{
				activeClientId: '33333333-3333-4333-8333-333333333333',
				activeRole: 'manager'
			}
		);
	});

	it('allows login for accounts that still must change their password', async () => {
		// temporary-password accounts still need a valid session so the follow-up redirect can send them
		// to the account password form instead of failing login entirely.
		const pepper = 'pepper-secret';
		const sessionSecret = 'session-secret';
		const password = 'TempPass123!';
		const storedHash = await hashPassword({
			password,
			pepper,
			iterations: 210_000
		});

		const createSessionSpy = vi.spyOn(sessionModule, 'createSessionForUser').mockResolvedValue({
			session: {
				id: 'session-2',
				userId: 'user-2',
				clientId: '44444444-4444-4444-8444-444444444444',
				activeClientId: '44444444-4444-4444-8444-444444444444',
				role: 'participant',
				authProvider: 'password',
				expiresAt: new Date().toISOString()
			},
			user: {
				id: 'user-2',
				clientId: '44444444-4444-4444-8444-444444444444',
				role: 'participant',
				mustChangePassword: true
			}
		} as any);

		const dbOps = {
			users: {
				getAuthByEmail: vi.fn().mockResolvedValue({
					id: 'user-2',
					email: 'temp@playims.com',
					passwordHash: storedHash,
					status: 'active',
					mustChangePassword: 1
				}),
				markLoginSuccess: vi.fn().mockResolvedValue({
					id: 'user-2',
					email: 'temp@playims.com',
					passwordHash: storedHash,
					status: 'active',
					mustChangePassword: 1
				})
			},
			userClients: {
				getDefaultActiveForUser: vi.fn().mockResolvedValue({
					userId: 'user-2',
					clientId: '44444444-4444-4444-8444-444444444444',
					role: 'participant',
					status: 'active'
				}),
				getFirstActiveForUser: vi.fn().mockResolvedValue(null)
			}
		} as any;

		const event = {
			platform: {
				env: {
					AUTH_SESSION_SECRET: sessionSecret,
					AUTH_PASSWORD_PEPPER: pepper
				}
			}
		} as any;

		await loginWithPassword(event, dbOps, {
			email: 'temp@playims.com',
			password
		});

		// the login should succeed normally; the forced-change behavior happens on the next guarded request.
		expect(createSessionSpy).toHaveBeenCalledWith(
			event,
			dbOps,
			expect.objectContaining({
				id: 'user-2',
				mustChangePassword: 1
			}),
			sessionSecret,
			{
				activeClientId: '44444444-4444-4444-8444-444444444444',
				activeRole: 'participant'
			}
		);
	});
});
