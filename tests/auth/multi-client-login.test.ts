import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as sessionModule from '../../src/lib/server/auth/session';
import { hashPassword } from '../../src/lib/server/auth/password';
import { loginWithPassword } from '../../src/lib/server/auth/service';

describe('multi-client login behavior', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('chooses default active membership for session client context', async () => {
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

		const dbOps = {
			users: {
				getAuthByEmail: vi.fn().mockResolvedValue({
					id: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					email: 'user@playims.com',
					passwordHash: storedHash,
					status: 'active',
					role: 'player'
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
});
