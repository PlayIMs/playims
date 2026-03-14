/*
Brief description:
This file verifies the mega search GET route for public and authenticated requests.

Deeper explanation:
The route is the user-facing contract for live search. It needs to return grouped results, enforce
auth-aware visibility, hide inactive data, and combine empty-state recents with shortcuts. These
tests drive the real route through mocked database contexts so the search behavior stays predictable.

Summary of tests:
1. It verifies that public requests only return public page results.
2. It verifies that authenticated requests return grouped page and record results while hiding inactive rows.
3. It verifies that participant users do not receive restricted dashboard pages in results.
4. It verifies that empty queries return recent items plus shortcuts.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		centralDbOps: {
			members: {
				searchByClient: vi.fn()
			},
			searchRecents: {
				listByUserAndClient: vi.fn()
			}
		},
		tenantDbOps: {
			seasons: {
				getByClientId: vi.fn()
			},
			offerings: {
				getByClientId: vi.fn()
			},
			leagues: {
				getByClientId: vi.fn()
			},
			divisions: {
				getByLeagueIds: vi.fn()
			},
			teams: {
				getByClientId: vi.fn()
			},
			facilities: {
				getAll: vi.fn()
			},
			facilityAreas: {
				getAll: vi.fn()
			}
		},
		getCentralDbOps: vi.fn(),
		getTenantDbOps: vi.fn()
	};
});

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.centralDbOps);
	mocks.getTenantDbOps.mockImplementation(async () => mocks.tenantDbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps,
		getTenantDbOps: mocks.getTenantDbOps
	};
});

import { GET } from '../../src/routes/api/search/+server';

const createEvent = (input: {
	query?: string;
	season?: string | null;
	role?: string | null;
	baseRole?: string | null;
	userId?: string | null;
	clientId?: string | null;
}) =>
	({
		url: new URL(
			`https://playims.test/api/search${
				input.query || input.season
					? `?${[
							input.query ? `q=${encodeURIComponent(input.query)}` : '',
							input.season ? `season=${encodeURIComponent(input.season)}` : ''
						]
							.filter(Boolean)
							.join('&')}`
					: ''
			}`
		),
		request: new Request(
			`https://playims.test/api/search${
				input.query || input.season
					? `?${[
							input.query ? `q=${encodeURIComponent(input.query)}` : '',
							input.season ? `season=${encodeURIComponent(input.season)}` : ''
						]
							.filter(Boolean)
							.join('&')}`
					: ''
			}`
		),
		platform: { env: { DB: {} } },
		locals: {
			user: input.userId
				? {
						id: input.userId,
						clientId: input.clientId ?? 'client-1',
						role: input.role ?? 'admin',
						baseRole: input.baseRole ?? input.role ?? 'admin'
					}
				: null,
			session: input.userId
				? {
						id: 'session-1',
						userId: input.userId,
						clientId: input.clientId ?? 'client-1',
						activeClientId: input.clientId ?? 'client-1',
						role: input.role ?? 'admin',
						baseRole: input.baseRole ?? input.role ?? 'admin'
					}
				: null
		}
	}) as any;

describe('mega search GET route', () => {
	beforeEach(() => {
		// each test starts from a neutral empty-search baseline and overrides only what matters.
		vi.clearAllMocks();
		mocks.centralDbOps.members.searchByClient.mockResolvedValue({
			rows: [],
			totalCount: 0,
			hasNextPage: false,
			hasPreviousPage: false,
			page: 1
		});
		mocks.centralDbOps.searchRecents.listByUserAndClient.mockResolvedValue([]);
		mocks.tenantDbOps.seasons.getByClientId.mockResolvedValue([]);
		mocks.tenantDbOps.offerings.getByClientId.mockResolvedValue([]);
		mocks.tenantDbOps.leagues.getByClientId.mockResolvedValue([]);
		mocks.tenantDbOps.divisions.getByLeagueIds.mockResolvedValue([]);
		mocks.tenantDbOps.teams.getByClientId.mockResolvedValue([]);
		mocks.tenantDbOps.facilities.getAll.mockResolvedValue([]);
		mocks.tenantDbOps.facilityAreas.getAll.mockResolvedValue([]);
	});

	it('returns only public pages for public requests', async () => {
		// logged-out search should stay useful without leaking dashboard or record data.
		const response = await GET(createEvent({ query: 'log' }));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.groups).toHaveLength(1);
		expect(payload.groups[0].category).toBe('pages');
		expect(payload.groups[0].items.some((item: { href: string }) => item.href === '/log-in')).toBe(
			true
		);
		expect(mocks.getTenantDbOps).not.toHaveBeenCalled();
		expect(mocks.centralDbOps.members.searchByClient).not.toHaveBeenCalled();
	});

	it('supports multi-term league and division matches within the selected season', async () => {
		// legacy leagues can infer their season from year plus season text, so selected-season search
		// needs to keep matching them instead of relying on seasonId always being populated.
		mocks.centralDbOps.members.searchByClient.mockResolvedValue({
			rows: [
				{
					membershipId: 'member-1',
					fullName: 'Jamie Member',
					email: 'jamie@playims.test',
					role: 'participant'
				}
			],
			totalCount: 1,
			hasNextPage: false,
			hasPreviousPage: false,
			page: 1
		});
		mocks.tenantDbOps.seasons.getByClientId.mockResolvedValue([
			{ id: 'season-1', name: 'Fall 2026', slug: 'fall-2026', isActive: 1, isCurrent: 1 },
			{ id: 'season-2', name: 'Spring 2026', slug: 'spring-2026', isActive: 1, isCurrent: 0 }
		]);
		mocks.tenantDbOps.offerings.getByClientId.mockResolvedValue([
			{
				id: 'offering-1',
				seasonId: 'season-1',
				name: 'Softball',
				slug: 'softball',
				type: 'league',
				isActive: 1
			},
			{
				id: 'offering-2',
				seasonId: 'season-2',
				name: 'Softball',
				slug: 'softball',
				type: 'league',
				isActive: 1
			}
		]);
		mocks.tenantDbOps.leagues.getByClientId.mockResolvedValue([
			{
				id: 'league-1',
				seasonId: null,
				offeringId: 'offering-1',
				name: 'Co-Rec',
				slug: 'co-rec',
				season: 'Fall',
				year: 2026,
				isActive: 1
			},
			{
				id: 'league-2',
				seasonId: null,
				offeringId: 'offering-2',
				name: 'Co-Rec Legacy',
				slug: 'co-rec-legacy',
				season: 'Spring',
				year: 2026,
				isActive: 1
			}
		]);
		mocks.tenantDbOps.divisions.getByLeagueIds.mockResolvedValue([
			{
				id: 'division-1',
				leagueId: 'league-1',
				name: 'Division A',
				slug: 'division-a',
				isActive: 1
			},
			{
				id: 'division-2',
				leagueId: 'league-2',
				name: 'Division A',
				slug: 'division-a',
				isActive: 1
			}
		]);
		mocks.tenantDbOps.teams.getByClientId.mockResolvedValue([
			{
				id: 'team-1',
				divisionId: 'division-1',
				name: 'Soccer Stars',
				slug: 'soccer-stars',
				teamStatus: 'active',
				isActive: 1
			},
			{
				id: 'team-2',
				divisionId: 'division-1',
				name: 'Archived Team',
				slug: 'archived-team',
				teamStatus: 'active',
				isActive: 0
			}
		]);
		mocks.tenantDbOps.facilities.getAll.mockResolvedValue([
			{ id: 'facility-1', name: 'Main Gym', slug: 'main-gym', isActive: 1 }
		]);
		mocks.tenantDbOps.facilityAreas.getAll.mockResolvedValue([
			{
				id: 'area-1',
				facilityId: 'facility-1',
				name: 'Court A',
				slug: 'court-a',
				isActive: 1
			}
		]);

		const response = await GET(
			createEvent({
				query: 'corec softball division a',
				season: 'fall-2026',
				userId: 'user-1',
				role: 'admin'
			})
		);
		const payload = await response.json();
		const categories = payload.groups.map((group: { category: string }) => group.category);
		const serialized = JSON.stringify(payload.groups);

		expect(response.status).toBe(200);
		expect(categories).toContain('offerings');
		expect(categories).toContain('leagues');
		expect(categories).toContain('divisions');
		expect(serialized).toContain('Co-Rec');
		expect(serialized).toContain('Division A');
		expect(serialized).not.toContain('Co-Rec Legacy');
		expect(serialized).not.toContain('Archived Team');
	});

	it('filters restricted dashboard pages for participant users', async () => {
		// participant mode should inherit the existing nav visibility rules instead of exposing admin destinations.
		const response = await GET(
			createEvent({ query: 'set', userId: 'user-2', role: 'participant' })
		);
		const payload = await response.json();
		const serialized = JSON.stringify(payload.groups);

		expect(serialized).not.toContain('/dashboard/settings');
	});

	it('returns recents and shortcuts when no query is provided', async () => {
		// the empty state should still feel useful before the user starts typing.
		mocks.centralDbOps.searchRecents.listByUserAndClient.mockResolvedValue([
			{
				id: 'recent-1',
				resultKey: 'pages:/dashboard/facilities',
				category: 'recent',
				title: 'Facilities',
				subtitle: 'Recent page',
				href: '/dashboard/facilities',
				badge: 'Recent',
				meta: null
			}
		]);

		const response = await GET(createEvent({ userId: 'user-3', role: 'admin' }));
		const payload = await response.json();
		const categories = payload.groups.map((group: { category: string }) => group.category);

		expect(categories).toContain('recent');
		expect(categories).toContain('shortcuts');
	});
});
