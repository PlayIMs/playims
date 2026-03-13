/*
Brief description:
This file verifies the main self-join decisions in the join-client API route.

Deeper explanation:
Joining an organization changes membership records, default membership state, and the current session
context. Those steps must stay aligned or the user can end up partially joined or switched into the
wrong organization. These tests mock the central database layer so the route logic can be exercised
one policy branch at a time.

Summary of tests:
1. It verifies that self-join is blocked when the organization disables it.
2. It verifies that an allowed self-join creates membership state and switches the active client.
3. It verifies that archived memberships cannot self-join back through the open join route.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks ensure the route imports our fake central database layer instead of the real one.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			clients: {
				getById: vi.fn(),
				getByNormalizedSlug: vi.fn()
			},
			userClients: {
				getMembership: vi.fn(),
				ensureMembership: vi.fn(),
				setDefaultMembership: vi.fn()
			},
			sessions: {
				updateClientContext: vi.fn()
			}
		},
		getCentralDbOps: vi.fn()
	};
});

// the route still runs normally, but every database branch is now controlled by the test.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { POST } from '../../src/routes/api/auth/join-client/+server';

// this helper builds a realistic authenticated request so each test only changes the join payload.
const createEvent = (body: Record<string, unknown>) =>
	({
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
		request: new Request('https://playims.test/api/auth/join-client', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as any;

describe('join-client endpoint', () => {
	beforeEach(() => {
		// clearing calls between tests prevents one scenario from leaking into another.
		vi.clearAllMocks();
	});

	it('blocks open self-join when organization setting is disabled', async () => {
		// self join enabled is the route's main policy flag, so this test proves the deny path short-circuits.
		mocks.dbOps.clients.getByNormalizedSlug.mockResolvedValue({
			id: '22222222-2222-4222-8222-222222222222',
			slug: 'org-a',
			name: 'Org A',
			status: 'active',
			selfJoinEnabled: 0
		});
		mocks.dbOps.userClients.getMembership.mockResolvedValue(null);

		const response = await POST(createEvent({ clientSlug: 'org-a' }));
		expect(response.status).toBe(403);
		expect(mocks.dbOps.userClients.ensureMembership).not.toHaveBeenCalled();
	});

	it('joins allowed org, sets default membership, and switches active client context', async () => {
		// this is the happy path where the route needs to coordinate membership creation and session updates.
		mocks.dbOps.clients.getByNormalizedSlug.mockResolvedValue({
			id: '33333333-3333-4333-8333-333333333333',
			slug: 'org-b',
			name: 'Org B',
			status: 'active',
			selfJoinEnabled: 1
		});
		mocks.dbOps.userClients.getMembership.mockResolvedValue(null);
		mocks.dbOps.userClients.ensureMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: '33333333-3333-4333-8333-333333333333',
			role: 'participant',
			status: 'active',
			isDefault: 1
		});
		mocks.dbOps.sessions.updateClientContext.mockResolvedValue({ id: 'session-1' });
		mocks.dbOps.userClients.setDefaultMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: '33333333-3333-4333-8333-333333333333',
			isDefault: 1
		});

		const event = createEvent({ clientSlug: 'org-b' });
		const response = await POST(event);
		const payload = (await response.json()) as {
			success: boolean;
			data: { clientId: string; joinedNow: boolean; role: string };
		};

		// these assertions prove both the api response and the in-memory locals were switched together.
		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.joinedNow).toBe(true);
		expect(payload.data.clientId).toBe('33333333-3333-4333-8333-333333333333');
		expect(payload.data.role).toBe('participant');
		expect(event.locals.session.activeClientId).toBe('33333333-3333-4333-8333-333333333333');
		expect(event.locals.user.clientId).toBe('33333333-3333-4333-8333-333333333333');
		expect(mocks.dbOps.userClients.ensureMembership).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				clientId: '33333333-3333-4333-8333-333333333333',
				role: 'participant'
			})
		);
		expect(mocks.dbOps.sessions.updateClientContext).toHaveBeenCalledWith(
			'session-1',
			'33333333-3333-4333-8333-333333333333',
			expect.any(String)
		);
	});

	it('rejects self-join when existing membership is inactive', async () => {
		// archived memberships should not be silently reactivated through the public self-join flow.
		mocks.dbOps.clients.getByNormalizedSlug.mockResolvedValue({
			id: '44444444-4444-4444-8444-444444444444',
			slug: 'org-c',
			name: 'Org C',
			status: 'active',
			selfJoinEnabled: 1
		});
		mocks.dbOps.userClients.getMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: '44444444-4444-4444-8444-444444444444',
			role: 'manager',
			status: 'archived',
			isDefault: 0
		});

		const response = await POST(createEvent({ clientSlug: 'org-c' }));
		expect(response.status).toBe(403);
		expect(mocks.dbOps.userClients.ensureMembership).not.toHaveBeenCalled();
	});
});
