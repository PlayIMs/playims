import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			userClients: {
				getActiveMembership: vi.fn(),
				setDefaultMembership: vi.fn()
			},
			sessions: {
				updateClientContext: vi.fn()
			}
		},
		DatabaseOperations: vi.fn()
	};
});

vi.mock('$lib/database', () => {
	mocks.DatabaseOperations.mockImplementation(() => mocks.dbOps);
	return {
		DatabaseOperations: mocks.DatabaseOperations
	};
});

import { POST } from '../../src/routes/api/auth/switch-client/+server';

describe('switch-client endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects switching to an unauthorized client', async () => {
		mocks.dbOps.userClients.getActiveMembership.mockResolvedValue(null);

		const event = {
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager'
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					activeClientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/api/auth/switch-client', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ clientId: '22222222-2222-4222-8222-222222222222' })
			})
		} as any;

		const response = await POST(event);
		expect(response.status).toBe(403);
		expect(mocks.dbOps.sessions.updateClientContext).not.toHaveBeenCalled();
	});

	it('updates current session + locals when switching to an authorized client', async () => {
		mocks.dbOps.userClients.getActiveMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: '33333333-3333-4333-8333-333333333333',
			role: 'admin',
			status: 'active'
		});
		mocks.dbOps.sessions.updateClientContext.mockResolvedValue({
			id: 'session-1'
		});
		mocks.dbOps.userClients.setDefaultMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: '33333333-3333-4333-8333-333333333333',
			isDefault: 1
		});

		const event = {
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager'
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					clientId: '11111111-1111-4111-8111-111111111111',
					activeClientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager',
					authProvider: 'password',
					expiresAt: new Date(Date.now() + 60_000).toISOString()
				}
			},
			request: new Request('https://playims.test/api/auth/switch-client', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ clientId: '33333333-3333-4333-8333-333333333333' })
			})
		} as any;

		const response = await POST(event);
		const payload = (await response.json()) as {
			success: boolean;
			data: {
				user: { clientId: string; role: string };
				session: { activeClientId: string; role: string };
			};
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.session.activeClientId).toBe('33333333-3333-4333-8333-333333333333');
		expect(payload.data.user.clientId).toBe('33333333-3333-4333-8333-333333333333');
		expect(payload.data.session.role).toBe('admin');
		expect(mocks.dbOps.sessions.updateClientContext).toHaveBeenCalledWith(
			'session-1',
			'33333333-3333-4333-8333-333333333333',
			expect.any(String)
		);
	});
});
