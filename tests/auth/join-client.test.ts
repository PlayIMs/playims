import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { POST } from '../../src/routes/api/auth/join-client/+server';

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
		vi.clearAllMocks();
	});

	it('blocks open self-join when organization setting is disabled', async () => {
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
			role: 'manager',
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

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.joinedNow).toBe(true);
		expect(payload.data.clientId).toBe('33333333-3333-4333-8333-333333333333');
		expect(payload.data.role).toBe('manager');
		expect(event.locals.session.activeClientId).toBe('33333333-3333-4333-8333-333333333333');
		expect(event.locals.user.clientId).toBe('33333333-3333-4333-8333-333333333333');
		expect(mocks.dbOps.sessions.updateClientContext).toHaveBeenCalledWith(
			'session-1',
			'33333333-3333-4333-8333-333333333333',
			expect.any(String)
		);
	});

	it('rejects self-join when existing membership is inactive', async () => {
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
