import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			userClients: {
				listActiveForUserWithClientDetails: vi.fn()
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

import { GET } from '../../src/routes/api/auth/session/+server';

describe('auth session endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when unauthenticated', async () => {
		const response = await GET({
			locals: {},
			platform: { env: { DB: {} } }
		} as any);

		expect(response.status).toBe(401);
	});

	it('returns active memberships with client metadata', async () => {
		mocks.dbOps.userClients.listActiveForUserWithClientDetails.mockResolvedValue([
			{
				membership: {
					clientId: '11111111-1111-4111-8111-111111111111',
					role: 'manager',
					isDefault: 1
				},
				client: {
					slug: 'org-a',
					name: 'Org A',
					status: 'active'
				}
			}
		]);

		const response = await GET({
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
			platform: { env: { DB: {} } }
		} as any);

		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			success: boolean;
			data: {
				memberships: Array<{
					clientId: string;
					clientSlug: string | null;
					clientName: string | null;
					clientStatus: string | null;
					role: string;
					isDefault: boolean;
				}>;
			};
		};

		expect(payload.success).toBe(true);
		expect(payload.data.memberships[0]).toEqual({
			clientId: '11111111-1111-4111-8111-111111111111',
			clientSlug: 'org-a',
			clientName: 'Org A',
			clientStatus: 'active',
			role: 'manager',
			isDefault: true
		});
	});
});
