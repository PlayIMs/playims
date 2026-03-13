/*
Brief description:
This file verifies the authenticated session summary endpoint.

Deeper explanation:
The session endpoint is the bridge between auth state and the dashboard's organization switcher. It
must reject anonymous requests and return membership details in a stable shape for authenticated users.
These tests mock the central database helper so the route contract stays easy to read.

Summary of tests:
1. It verifies that unauthenticated requests return 401.
2. It verifies that authenticated requests include active memberships with client metadata.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks make sure the route module binds to fake database helpers during import.
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

// the route stays real, but all membership data now comes from the controlled fake layer.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { GET } from '../../src/routes/api/auth/session/+server';

describe('auth session endpoint', () => {
	beforeEach(() => {
		// each test starts with clean call history so response assertions stay trustworthy.
		vi.clearAllMocks();
	});

	it('returns 401 when unauthenticated', async () => {
		// this proves the route does not leak membership metadata without an authenticated session.
		const response = await GET({
			locals: {},
			platform: { env: { DB: {} } }
		} as any);

		expect(response.status).toBe(401);
	});

	it('returns active memberships with client metadata', async () => {
		// this fixture mirrors the shape the route has to flatten into the api response contract.
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

		// the flattened membership shape is what downstream dashboard code depends on.
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
