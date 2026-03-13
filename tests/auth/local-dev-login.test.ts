/*
Brief description:
This file verifies the localhost-only development login flow.

Deeper explanation:
Local development login is intentionally a narrow escape hatch, not a production auth path. These
tests protect the hostname gate, the default-client session behavior, and the helpful failure mode
for outdated local databases. That keeps the dev shortcut convenient without letting it become a
security or maintenance blind spot.

Summary of tests:
1. It verifies that only localhost-style hostnames are treated as local development hosts.
2. It verifies that local development login is rejected outside localhost.
3. It verifies that localhost login creates a session using the default client context.
4. It verifies that an outdated local database produces an actionable error code.
*/

import { describe, expect, it, vi } from 'vitest';
import * as sessionModule from '../../src/lib/server/auth/session';
import { DEFAULT_CLIENT } from '../../src/lib/server/client-context';
import { AuthServiceError, loginWithLocalDevCredentials } from '../../src/lib/server/auth/service';
import { isLocalhostHostname } from '../../src/lib/server/auth/local-dev';

describe('localhost dev login', () => {
	it('matches localhost hostnames only', () => {
		// this keeps the feature scoped to real local hosts instead of any arbitrary domain.
		expect(isLocalhostHostname('localhost')).toBe(true);
		expect(isLocalhostHostname('127.0.0.1')).toBe(true);
		expect(isLocalhostHostname('playims.com')).toBe(false);
	});

	it('blocks local dev login outside localhost', async () => {
		// production-like hosts must fail before any fallback developer login logic runs.
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
		// spying on session creation lets the test prove which client context is used without creating
		// a real session record.
		const createSessionSpy = vi.spyOn(sessionModule, 'createSessionForUser').mockResolvedValue({
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				activeClientId: DEFAULT_CLIENT.id,
				role: 'dev',
				authProvider: 'password',
				expiresAt: new Date().toISOString()
			},
			user: {
				id: 'user-1',
				clientId: DEFAULT_CLIENT.id,
				role: 'dev'
			}
		} as any);

		// this fake db shape mirrors the minimum successful developer-login path.
		const dbOps = {
			clients: {
				getById: vi.fn().mockResolvedValue({ id: DEFAULT_CLIENT.id })
			},
			users: {
				getByClientId: vi.fn().mockResolvedValue([
					{
						id: 'user-1',
						status: 'active'
					}
				]),
				getAuthById: vi.fn().mockResolvedValue({
					id: 'user-1',
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
					role: 'dev',
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

		// the default client is the important contract here because the dev path bootstraps from it.
		expect(dbOps.users.getByClientId).toHaveBeenCalledWith(DEFAULT_CLIENT.id);
		expect(createSessionSpy).toHaveBeenCalledWith(
			event,
			dbOps,
			expect.any(Object),
			'session-secret',
			{
				activeClientId: DEFAULT_CLIENT.id,
				activeRole: 'dev'
			}
		);
	});

	it('returns actionable error when local DB is missing user_clients table', async () => {
		// this specific low-level error should be translated into a higher-level maintenance message.
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
