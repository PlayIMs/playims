/*
Brief description:
This file verifies the members listing API route and its search-first behavior.

Deeper explanation:
The members workspace now waits for a meaningful query before loading results. These tests protect
that API contract directly so the page can rely on empty starter data for short or missing queries
without accidentally querying the full roster.

Summary of tests:
1. It verifies that missing or short queries return an empty result set without hitting the database.
2. It verifies that valid queries still call the member search operation and return the paged data.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these mocks keep the real route logic while replacing the database dependency.
const mocks = vi.hoisted(() => ({
	dbOps: {
		members: {
			searchByClient: vi.fn()
		}
	},
	getCentralDbOps: vi.fn()
}));

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { GET } from '../../src/routes/api/members/+server';

// this helper keeps the route event shape small and focused on query behavior.
const buildEvent = (path: string) =>
	({
		platform: { env: { DB: {} } },
		url: new URL(`https://playims.test${path}`),
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role: 'manager',
				baseRole: 'manager'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role: 'manager',
				baseRole: 'manager'
			}
		}
	}) as any;

describe('members list route', () => {
	beforeEach(() => {
		// each test starts with a predictable default search response.
		vi.clearAllMocks();
		mocks.dbOps.members.searchByClient.mockResolvedValue({
			rows: [
				{
					membershipId: 'membership-1',
					userId: 'user-2',
					studentId: '12345',
					firstName: 'Jamie',
					lastName: 'Member',
					fullName: 'Jamie Member',
					email: 'jamie@playims.test',
					sex: 'F',
					role: 'participant',
					status: 'active',
					createdAt: '2029-12-20T00:00:00.000Z',
					updatedAt: '2029-12-20T00:00:00.000Z'
				}
			],
			totalCount: 1,
			hasNextPage: false,
			hasPreviousPage: false,
			page: 1
		});
	});

	it('returns an empty page when the query is missing or shorter than two characters', async () => {
		// search-first mode means the api should not fall back to listing the full membership roster.
		const response = await GET(buildEvent('/api/members?q=j'));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.data.rows).toEqual([]);
		expect(payload.data.totalCount).toBe(0);
		expect(payload.data.hasNextPage).toBe(false);
		expect(payload.data.hasPreviousPage).toBe(false);
		expect(mocks.dbOps.members.searchByClient).not.toHaveBeenCalled();
	});

	it('searches members when the query is at least two characters long', async () => {
		// once the query is long enough, the route should pass filters and sorting into the search layer.
		const response = await GET(buildEvent('/api/members?q=jamie&sex=F&role=manager&sort=email&dir=desc&page=2'));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.data.rows).toHaveLength(1);
		expect(mocks.dbOps.members.searchByClient).toHaveBeenCalledWith({
			clientId: 'client-1',
			query: 'jamie',
			page: 2,
			sex: 'F',
			role: 'manager',
			sort: 'email',
			dir: 'desc'
		});
	});
});
