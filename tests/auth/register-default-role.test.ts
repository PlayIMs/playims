import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CLIENT } from '../../src/lib/server/client-context';
import * as sessionModule from '../../src/lib/server/auth/session';
import { registerWithPassword } from '../../src/lib/server/auth/service';

describe('register defaults', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('assigns player role for invite-based self-service registration', async () => {
		const createSessionSpy = vi.spyOn(sessionModule, 'createSessionForUser').mockResolvedValue({
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				activeClientId: DEFAULT_CLIENT.id,
				role: 'player',
				authProvider: 'password',
				expiresAt: new Date().toISOString()
			},
			user: {
				id: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				role: 'player'
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
					clientId: DEFAULT_CLIENT.id,
					email: 'player@playims.com',
					role: 'player',
					status: 'active'
				}),
				markLoginSuccess: vi.fn().mockResolvedValue(null)
			},
			userClients: {
				ensureMembership: vi.fn().mockResolvedValue({
					userId: 'user-1',
					clientId: DEFAULT_CLIENT.id,
					role: 'player',
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
			email: 'player@playims.com',
			password: 'StrongPass123',
			inviteKey: 'invite-key',
			firstName: 'Pat',
			lastName: 'Player'
		});

		expect(dbOps.users.createAuthUser).toHaveBeenCalledWith(
			expect.objectContaining({
				role: 'player'
			})
		);
		expect(dbOps.userClients.ensureMembership).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				role: 'player'
			})
		);
		expect(dbOps.signupInviteKeys.consumeByHash).toHaveBeenCalledTimes(1);
		expect(createSessionSpy).toHaveBeenCalledWith(event, dbOps, expect.any(Object), 'session-secret', {
			activeClientId: DEFAULT_CLIENT.id,
			activeRole: 'player'
		});
	});
});
