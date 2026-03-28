/*
Brief description:
This file verifies the server load for the dashboard members page.

Deeper explanation:
The page now starts in a search-first state, which means the load function should avoid fetching the
full roster until the query is meaningful. These tests protect that initial payload so the UI can
render a guided empty state instead of a surprise full-table load.

Summary of tests:
1. It verifies that the page returns an empty starter payload when there is no search query.
2. It verifies that a valid search query calls the member search operation and returns its results.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these mocks replace only the database layer so the real load branching stays under test.
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

import { load } from '../../src/routes/dashboard/members/+page.server';

// this helper keeps the authenticated load event compact and readable.
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

describe('dashboard members page load', () => {
	beforeEach(() => {
		// each test starts with one resolved search result so the assertions can focus on branching.
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

	it('returns an empty starter payload when there is no active search', async () => {
		// the page should guide the user to search instead of loading the entire organization roster.
		const result = await load(buildEvent('/dashboard/members'));

		expect(result.members.rows).toEqual([]);
		expect(result.members.totalCount).toBe(0);
		expect(result.members.query).toBe('');
		expect(result).not.toHaveProperty('pendingInvites');
		expect(mocks.dbOps.members.searchByClient).not.toHaveBeenCalled();
	});

	it('loads matching members once the search query is at least two characters', async () => {
		// valid searches should still hydrate the page from the server so the first render is useful.
		const result = await load(buildEvent('/dashboard/members?q=jamie&sort=email&dir=desc&page=2'));

		expect(result.members.rows).toHaveLength(1);
		expect(result.members.totalCount).toBe(1);
		expect(mocks.dbOps.members.searchByClient).toHaveBeenCalledWith({
			clientId: 'client-1',
			query: 'jamie',
			page: 2,
			sex: null,
			role: null,
			sort: 'email',
			dir: 'desc'
		});
	});
});
