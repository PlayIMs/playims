/*
Brief description:
This file verifies the default role assigned during invite-based password registration.

Deeper explanation:
Self-service registration should not let invite-based users create themselves with elevated access.
This test focuses on the registration service path that consumes an invite and creates membership
state. It protects the rule that participant access is the default outcome unless a separate admin
flow assigns something stronger.

Summary of tests:
1. It verifies that invite-based self-service registration creates participant membership without writing a direct role on the user payload.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CLIENT } from '../../src/lib/server/client-context';
import * as sessionModule from '../../src/lib/server/auth/session';
import { registerWithPassword } from '../../src/lib/server/auth/service';

describe('register defaults', () => {
	beforeEach(() => {
		// restoring spies keeps the registration flow isolated from other auth tests.
		vi.restoreAllMocks();
	});

	it('assigns participant role for invite-based self-service registration', async () => {
		// spying on session creation lets this test focus on the role and membership contract.
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

		// this fake database shape covers the minimal successful invite-registration path.
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
		// the user payload should not carry an elevated role directly because membership creation owns that decision.
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
