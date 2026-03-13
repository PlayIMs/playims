/*
Brief description:
This file verifies the API route that switches a user into a different active client.

Deeper explanation:
Switching organizations updates both persistent session state and the in-memory locals returned to
the client. If either side drifts, the user can land in a broken mixed-client state. These tests mock
the central database layer so the route's authorization and synchronization rules stay explicit.

Summary of tests:
1. It verifies that switching to an unauthorized client is rejected.
2. It verifies that an authorized switch updates both the response payload and the session context.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks keep the route module connected to fake central-db helpers during import.
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
		getCentralDbOps: vi.fn()
	};
});

// the route still executes its real logic, but all database reads and writes are test-controlled.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { POST } from '../../src/routes/api/auth/switch-client/+server';

describe('switch-client endpoint', () => {
	beforeEach(() => {
		// clearing calls between tests prevents the authorization and success paths from overlapping.
		vi.clearAllMocks();
	});

	it('rejects switching to an unauthorized client', async () => {
		// a missing active membership should stop the route before any session update is attempted.
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
		// this happy path proves the route coordinates membership, session, and response state together.
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

		// these assertions make sure the returned payload and the persisted session both point at the new client.
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
