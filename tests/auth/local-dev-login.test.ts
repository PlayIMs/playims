import { describe, expect, it, vi } from 'vitest';
import * as sessionModule from '../../src/lib/server/auth/session';
import { DEFAULT_CLIENT } from '../../src/lib/server/client-context';
import { AuthServiceError, loginWithLocalDevCredentials } from '../../src/lib/server/auth/service';
import { isLocalhostHostname } from '../../src/lib/server/auth/local-dev';

describe('localhost dev login', () => {
	it('matches localhost hostnames only', () => {
		expect(isLocalhostHostname('localhost')).toBe(true);
		expect(isLocalhostHostname('127.0.0.1')).toBe(true);
		expect(isLocalhostHostname('playims.com')).toBe(false);
	});

	it('blocks local dev login outside localhost', async () => {
		const event = {
			url: new URL('https://playims.com/log-in'),
			platform: {
				env: {
					AUTH_SESSION_SECRET: 'session-secret'
				}
			}
		} as any;

		await expect(loginWithLocalDevCredentials(event, {} as any)).rejects.toBeInstanceOf(
			AuthServiceError
		);
		await expect(loginWithLocalDevCredentials(event, {} as any)).rejects.toMatchObject({
			status: 401,
			code: 'AUTH_INVALID_CREDENTIALS'
		});
	});

	it('creates a session on localhost with default-client context', async () => {
		const createSessionSpy = vi.spyOn(sessionModule, 'createSessionForUser').mockResolvedValue({
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				activeClientId: DEFAULT_CLIENT.id,
				role: 'manager',
				authProvider: 'password',
				expiresAt: new Date().toISOString()
			},
			user: {
				id: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				role: 'manager'
			}
		} as any);

		const dbOps = {
			clients: {
				getById: vi.fn().mockResolvedValue({ id: DEFAULT_CLIENT.id })
			},
			users: {
				getByClientId: vi.fn().mockResolvedValue([
					{
						id: 'user-1',
						role: 'manager',
						status: 'active'
					}
				]),
				getAuthById: vi.fn().mockResolvedValue({
					id: 'user-1',
					clientId: DEFAULT_CLIENT.id,
					role: 'manager',
					status: 'active'
				}),
				getAuthByEmail: vi.fn().mockResolvedValue(null),
				createAuthUser: vi.fn(),
				markLoginSuccess: vi.fn().mockResolvedValue(null)
			},
			userClients: {
				ensureMembership: vi.fn().mockResolvedValue(null),
				getDefaultActiveForUser: vi.fn().mockResolvedValue({
					userId: 'user-1',
					clientId: DEFAULT_CLIENT.id,
					role: 'manager',
					status: 'active'
				}),
				getFirstActiveForUser: vi.fn().mockResolvedValue(null)
			}
		} as any;

		const event = {
			url: new URL('http://localhost:5173/log-in'),
			platform: {
				env: {
					AUTH_SESSION_SECRET: 'session-secret'
				}
			}
		} as any;

		await loginWithLocalDevCredentials(event, dbOps);

		expect(dbOps.users.getByClientId).toHaveBeenCalledWith(DEFAULT_CLIENT.id);
		expect(createSessionSpy).toHaveBeenCalledWith(
			event,
			dbOps,
			expect.any(Object),
			'session-secret',
			{
				activeClientId: DEFAULT_CLIENT.id,
				activeRole: 'manager'
			}
		);
	});

	it('returns actionable error when local DB is missing user_clients table', async () => {
		const event = {
			url: new URL('http://localhost:5173/log-in'),
			platform: {
				env: {
					AUTH_SESSION_SECRET: 'session-secret'
				}
			}
		} as any;

		const dbOps = {
			clients: {
				getById: vi.fn().mockResolvedValue({ id: DEFAULT_CLIENT.id })
			},
			users: {
				getByClientId: vi.fn().mockRejectedValue(new Error('no such table: user_clients'))
			}
		} as any;

		await expect(loginWithLocalDevCredentials(event, dbOps)).rejects.toMatchObject({
			status: 500,
			code: 'AUTH_LOCAL_DEV_DB_OUTDATED'
		});
	});
});
