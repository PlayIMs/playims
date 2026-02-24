import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			sessions: {
				setViewAsRole: vi.fn()
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

import { POST } from '../../src/routes/api/auth/view-as-role/+server';

describe('view-as-role endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when unauthenticated', async () => {
		const response = await POST({
			platform: { env: { DB: {} } },
			locals: {},
			request: new Request('https://playims.test/api/auth/view-as-role', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ targetRole: 'participant' })
			})
		} as any);

		expect(response.status).toBe(401);
	});

	it('allows manager to switch to participant view', async () => {
		mocks.dbOps.sessions.setViewAsRole.mockResolvedValue({ id: 'session-1' });
		const event = {
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager',
					baseRole: 'manager',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					activeClientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager',
					baseRole: 'manager',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null,
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/api/auth/view-as-role', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ targetRole: 'participant' })
			})
		} as any;

		const response = await POST(event);
		const payload = (await response.json()) as {
			success: boolean;
			data: {
				user: { role: string; baseRole: string; isViewingAsRole: boolean; viewAsRole: string | null };
				session: {
					role: string;
					baseRole: string;
					isViewingAsRole: boolean;
					viewAsRole: string | null;
				};
			};
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.user.role).toBe('participant');
		expect(payload.data.user.baseRole).toBe('manager');
		expect(payload.data.user.isViewingAsRole).toBe(true);
		expect(payload.data.user.viewAsRole).toBe('participant');
		expect(payload.data.session.role).toBe('participant');
		expect(payload.data.session.baseRole).toBe('manager');
		expect(payload.data.session.isViewingAsRole).toBe(true);
		expect(payload.data.session.viewAsRole).toBe('participant');
		expect(mocks.dbOps.sessions.setViewAsRole).toHaveBeenCalledWith(
			'session-1',
			'participant',
			expect.any(String)
		);
	});

	it('rejects participant base role from switching', async () => {
		const response = await POST({
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-2',
					clientId: '22222222-2222-4222-8222-222222222222',
					role: 'participant',
					baseRole: 'participant',
					canViewAsRole: false,
					isViewingAsRole: false,
					viewAsRole: null
				},
				session: {
					id: 'session-2',
					userId: 'user-2',
					clientId: '22222222-2222-4222-8222-222222222222',
					activeClientId: '22222222-2222-4222-8222-222222222222',
					role: 'participant',
					baseRole: 'participant',
					canViewAsRole: false,
					isViewingAsRole: false,
					viewAsRole: null,
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/api/auth/view-as-role', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ targetRole: 'participant' })
			})
		} as any);

		expect(response.status).toBe(403);
		expect(mocks.dbOps.sessions.setViewAsRole).not.toHaveBeenCalled();
	});

	it('rejects admin trying to switch to dev view', async () => {
		const response = await POST({
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-3',
					clientId: '33333333-3333-4333-8333-333333333333',
					role: 'admin',
					baseRole: 'admin',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null
				},
				session: {
					id: 'session-3',
					userId: 'user-3',
					clientId: '33333333-3333-4333-8333-333333333333',
					activeClientId: '33333333-3333-4333-8333-333333333333',
					role: 'admin',
					baseRole: 'admin',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null,
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/api/auth/view-as-role', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ targetRole: 'dev' })
			})
		} as any);

		expect(response.status).toBe(403);
		expect(mocks.dbOps.sessions.setViewAsRole).not.toHaveBeenCalled();
	});

	it('allows clearing role view override', async () => {
		mocks.dbOps.sessions.setViewAsRole.mockResolvedValue({ id: 'session-4' });
		const event = {
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-4',
					clientId: '44444444-4444-4444-8444-444444444444',
					role: 'participant',
					baseRole: 'dev',
					canViewAsRole: true,
					isViewingAsRole: true,
					viewAsRole: 'participant'
				},
				session: {
					id: 'session-4',
					userId: 'user-4',
					clientId: '44444444-4444-4444-8444-444444444444',
					activeClientId: '44444444-4444-4444-8444-444444444444',
					role: 'participant',
					baseRole: 'dev',
					canViewAsRole: true,
					isViewingAsRole: true,
					viewAsRole: 'participant',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/api/auth/view-as-role', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ targetRole: null })
			})
		} as any;

		const response = await POST(event);
		const payload = (await response.json()) as {
			data: { session: { role: string; baseRole: string; isViewingAsRole: boolean; viewAsRole: null } };
		};

		expect(response.status).toBe(200);
		expect(payload.data.session.role).toBe('dev');
		expect(payload.data.session.baseRole).toBe('dev');
		expect(payload.data.session.isViewingAsRole).toBe(false);
		expect(payload.data.session.viewAsRole).toBeNull();
		expect(mocks.dbOps.sessions.setViewAsRole).toHaveBeenCalledWith(
			'session-4',
			null,
			expect.any(String)
		);
	});
});
