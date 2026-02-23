import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			sessions: {
				setViewAsPlayer: vi.fn()
			}
		},
		getCentralDbOps: vi.fn()
	};
});

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { POST } from '../../src/routes/api/auth/view-as-player/+server';

describe('view-as-player endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when unauthenticated', async () => {
		const response = await POST({
			platform: { env: { DB: {} } },
			locals: {},
			request: new Request('https://playims.test/api/auth/view-as-player', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ enabled: true })
			})
		} as any);

		expect(response.status).toBe(401);
	});

	it('allows manager to enable player view and rewrites effective role', async () => {
		mocks.dbOps.sessions.setViewAsPlayer.mockResolvedValue({ id: 'session-1' });
		const event = {
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager',
					baseRole: 'manager',
					canViewAsPlayer: true,
					isViewingAsPlayer: false
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					activeClientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager',
					baseRole: 'manager',
					canViewAsPlayer: true,
					isViewingAsPlayer: false,
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/api/auth/view-as-player', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ enabled: true })
			})
		} as any;

		const response = await POST(event);
		const payload = (await response.json()) as {
			success: boolean;
			data: {
				user: { role: string; baseRole: string; isViewingAsPlayer: boolean };
				session: { role: string; baseRole: string; isViewingAsPlayer: boolean };
			};
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.user.role).toBe('player');
		expect(payload.data.user.baseRole).toBe('manager');
		expect(payload.data.user.isViewingAsPlayer).toBe(true);
		expect(payload.data.session.role).toBe('player');
		expect(payload.data.session.baseRole).toBe('manager');
		expect(payload.data.session.isViewingAsPlayer).toBe(true);
		expect(mocks.dbOps.sessions.setViewAsPlayer).toHaveBeenCalledWith(
			'session-1',
			true,
			expect.any(String)
		);
	});

	it('rejects enable request for player base role', async () => {
		const response = await POST({
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-2',
					clientId: '22222222-2222-4222-8222-222222222222',
					role: 'player',
					baseRole: 'player',
					canViewAsPlayer: false,
					isViewingAsPlayer: false
				},
				session: {
					id: 'session-2',
					userId: 'user-2',
					clientId: '22222222-2222-4222-8222-222222222222',
					activeClientId: '22222222-2222-4222-8222-222222222222',
					role: 'player',
					baseRole: 'player',
					canViewAsPlayer: false,
					isViewingAsPlayer: false,
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/api/auth/view-as-player', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ enabled: true })
			})
		} as any);

		expect(response.status).toBe(403);
		expect(mocks.dbOps.sessions.setViewAsPlayer).not.toHaveBeenCalled();
	});

	it('allows disabling player view even when effective role is player', async () => {
		mocks.dbOps.sessions.setViewAsPlayer.mockResolvedValue({ id: 'session-3' });
		const event = {
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-3',
					clientId: '33333333-3333-4333-8333-333333333333',
					role: 'player',
					baseRole: 'dev',
					canViewAsPlayer: true,
					isViewingAsPlayer: true
				},
				session: {
					id: 'session-3',
					userId: 'user-3',
					clientId: '33333333-3333-4333-8333-333333333333',
					activeClientId: '33333333-3333-4333-8333-333333333333',
					role: 'player',
					baseRole: 'dev',
					canViewAsPlayer: true,
					isViewingAsPlayer: true,
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/api/auth/view-as-player', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ enabled: false })
			})
		} as any;

		const response = await POST(event);
		const payload = (await response.json()) as {
			data: { session: { role: string; baseRole: string; isViewingAsPlayer: boolean } };
		};

		expect(response.status).toBe(200);
		expect(payload.data.session.role).toBe('dev');
		expect(payload.data.session.baseRole).toBe('dev');
		expect(payload.data.session.isViewingAsPlayer).toBe(false);
		expect(mocks.dbOps.sessions.setViewAsPlayer).toHaveBeenCalledWith(
			'session-3',
			false,
			expect.any(String)
		);
	});
});
