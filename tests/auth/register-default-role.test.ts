import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CLIENT } from '../../src/lib/server/client-context';
import * as sessionModule from '../../src/lib/server/auth/session';
import { registerWithPassword } from '../../src/lib/server/auth/service';

describe('register defaults', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('assigns participant role for invite-based self-service registration', async () => {
		const createSessionSpy = vi.spyOn(sessionModule, 'createSessionForUser').mockResolvedValue({
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				activeClientId: DEFAULT_CLIENT.id,
				role: 'participant',
				authProvider: 'password',
				expiresAt: new Date().toISOString()
			},
			user: {
				id: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				role: 'participant'
			}
		} as any);

		const dbOps = {
			clients: {
				getById: vi.fn().mockResolvedValue({ id: DEFAULT_CLIENT.id })
			},
			signupInviteKeys: {
				consumeByHash: vi.fn().mockResolvedValue({
					id: 'invite-1',
					keyHash: 'hash',
					uses: 0,
					expiresAt: null
				})
			},
			users: {
				getAuthByEmail: vi.fn().mockResolvedValue(null),
				createAuthUser: vi.fn().mockResolvedValue({
					id: 'user-1',
					email: 'participant@playims.com',
					status: 'active'
				}),
				markLoginSuccess: vi.fn().mockResolvedValue(null)
			},
			userClients: {
				ensureMembership: vi.fn().mockResolvedValue({
					userId: 'user-1',
					clientId: DEFAULT_CLIENT.id,
					role: 'participant',
					status: 'active',
					isDefault: 1
				})
			}
		} as any;

		const event = {
			platform: {
				env: {
					AUTH_SESSION_SECRET: 'session-secret',
					AUTH_PASSWORD_PEPPER: 'pepper-secret'
				}
			}
		} as any;

		await registerWithPassword(event, dbOps, {
			email: 'participant@playims.com',
			password: 'StrongPass123',
			inviteKey: 'invite-key',
			firstName: 'Pat',
			lastName: 'Player'
		});

		const createUserInput = dbOps.users.createAuthUser.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(createUserInput).toBeTruthy();
		expect('role' in createUserInput).toBe(false);
		expect(dbOps.userClients.ensureMembership).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				role: 'participant'
			})
		);
		expect(dbOps.signupInviteKeys.consumeByHash).toHaveBeenCalledTimes(1);
		expect(createSessionSpy).toHaveBeenCalledWith(event, dbOps, expect.any(Object), 'session-secret', {
			activeClientId: DEFAULT_CLIENT.id,
			activeRole: 'participant'
		});
	});
});
