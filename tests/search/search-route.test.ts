/*
Brief description:
This file verifies the mega search GET route for public and authenticated requests.

Deeper explanation:
The route is the user-facing contract for live search. It needs to return grouped results, enforce
auth-aware visibility, hide inactive data, and return a clean empty state without shortcut filler. These
tests drive the real route through mocked database contexts so the search behavior stays predictable.

Summary of tests:
1. It verifies that public requests only return public page results.
2. It verifies that authenticated requests hide unauthenticated pages like log-in and register.
3. It verifies that authorized users can search settings subpages like branding.
4. It verifies that authenticated requests return grouped page and record results while hiding inactive rows.
5. It verifies that participant users do not receive restricted dashboard pages in results.
6. It verifies that long team-name queries do not return loose one-word partial matches.
7. It verifies that team-name results deep-link to the nested team page.
8. It verifies that team results outrank divisions for equivalent team-name matches.
9. It verifies that empty queries return at most 8 recent items without shortcuts.
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
				searchByClient: vi.fn()
			},
			leagues: {
				searchByClient: vi.fn()
			},
			divisions: {
				searchByClient: vi.fn()
			},
			teams: {
				searchByClient: vi.fn()
			},
			facilities: {
				searchByClient: vi.fn()
			},
			facilityAreas: {
				searchByClient: vi.fn()
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
		mocks.tenantDbOps.offerings.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.leagues.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.divisions.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.teams.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.facilities.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.facilityAreas.searchByClient.mockResolvedValue([]);
	});

	it('returns only public pages for public requests', async () => {
		// logged-out search should stay useful without leaking dashboard or record data.
		const response = await GET(createEvent({ query: 'home' }));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.groups).toHaveLength(1);
		expect(payload.groups[0].category).toBe('pages');
		expect(payload.groups[0].items.map((item: { href: string }) => item.href)).toEqual(['/']);
		expect(mocks.getTenantDbOps).not.toHaveBeenCalled();
		expect(mocks.centralDbOps.members.searchByClient).not.toHaveBeenCalled();
	});

	it('hides unauthenticated routes from authenticated requests', async () => {
		// once the palette is auth-only, public account-entry pages should disappear from search results.
		const response = await GET(createEvent({ query: 'log', userId: 'user-1', role: 'admin' }));
		const payload = await response.json();
		const serialized = JSON.stringify(payload.groups);

		expect(response.status).toBe(200);
		expect(serialized).not.toContain('/log-in');
		expect(serialized).not.toContain('/register');
	});

	it('returns settings subpages only for users with matching permissions', async () => {
		// settings children are real destinations, so search should surface them only when the role can open them.
		const adminResponse = await GET(
			createEvent({ query: 'branding', userId: 'user-1', role: 'admin' })
		);
		const adminPayload = await adminResponse.json();
		const adminSerialized = JSON.stringify(adminPayload.groups);

		expect(adminResponse.status).toBe(200);
		expect(adminSerialized).toContain('/dashboard/settings/branding');

		const participantResponse = await GET(
			createEvent({ query: 'branding', userId: 'user-2', role: 'participant' })
		);
		const participantPayload = await participantResponse.json();
		const participantSerialized = JSON.stringify(participantPayload.groups);

		expect(participantResponse.status).toBe(200);
		expect(participantSerialized).not.toContain('/dashboard/settings/branding');
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
		mocks.tenantDbOps.offerings.searchByClient.mockResolvedValue([
			{
				id: 'offering-1',
				seasonId: 'season-1',
				name: 'Softball',
				slug: 'softball',
				type: 'league',
				isActive: 1,
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			},
			{
				id: 'offering-2',
				seasonId: 'season-2',
				name: 'Softball',
				slug: 'softball',
				type: 'league',
				isActive: 1,
				seasonName: 'Spring 2026',
				seasonSlug: 'spring-2026'
			}
		]);
		mocks.tenantDbOps.leagues.searchByClient.mockResolvedValue([
			{
				id: 'league-1',
				seasonId: null,
				offeringId: 'offering-1',
				name: 'Co-Rec',
				slug: 'co-rec',
				season: 'Fall',
				year: 2026,
				isActive: 1,
				offeringName: 'Softball',
				offeringSlug: 'softball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			},
			{
				id: 'league-2',
				seasonId: null,
				offeringId: 'offering-2',
				name: 'Co-Rec Legacy',
				slug: 'co-rec-legacy',
				season: 'Spring',
				year: 2026,
				isActive: 1,
				offeringName: 'Softball',
				offeringSlug: 'softball',
				seasonName: 'Spring 2026',
				seasonSlug: 'spring-2026'
			}
		]);
		mocks.tenantDbOps.divisions.searchByClient.mockResolvedValue([
			{
				id: 'division-1',
				leagueId: 'league-1',
				name: 'Division A',
				slug: 'division-a',
				isActive: 1,
				leagueName: 'Co-Rec',
				leagueSlug: 'co-rec',
				offeringName: 'Softball',
				offeringSlug: 'softball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			},
			{
				id: 'division-2',
				leagueId: 'league-2',
				name: 'Division A',
				slug: 'division-a',
				isActive: 1,
				leagueName: 'Co-Rec Legacy',
				leagueSlug: 'co-rec-legacy',
				offeringName: 'Softball',
				offeringSlug: 'softball',
				seasonName: 'Spring 2026',
				seasonSlug: 'spring-2026'
			}
		]);
		mocks.tenantDbOps.teams.searchByClient.mockResolvedValue([
			{
				id: 'team-1',
				divisionId: 'division-1',
				name: 'Soccer Stars',
				slug: 'soccer-stars',
				teamStatus: 'active',
				isActive: 1,
				divisionName: 'Division A',
				divisionSlug: 'division-a',
				leagueName: 'Co-Rec',
				leagueSlug: 'co-rec',
				offeringName: 'Softball',
				offeringSlug: 'softball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			},
			{
				id: 'team-2',
				divisionId: 'division-1',
				name: 'Archived Team',
				slug: 'archived-team',
				teamStatus: 'active',
				isActive: 0,
				divisionName: 'Division A',
				divisionSlug: 'division-a',
				leagueName: 'Co-Rec',
				leagueSlug: 'co-rec',
				offeringName: 'Softball',
				offeringSlug: 'softball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.facilities.searchByClient.mockResolvedValue([
			{ id: 'facility-1', name: 'Main Gym', slug: 'main-gym', isActive: 1 }
		]);
		mocks.tenantDbOps.facilityAreas.searchByClient.mockResolvedValue([
			{
				id: 'area-1',
				facilityId: 'facility-1',
				name: 'Court A',
				slug: 'court-a',
				isActive: 1,
				facilityName: 'Main Gym'
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
		expect(categories).toContain('leagues');
		expect(categories).toContain('divisions');
		expect(serialized).toContain('Co-Rec');
		expect(serialized).toContain('Division A');
		expect(serialized).not.toContain('Co-Rec Legacy');
		expect(serialized).not.toContain('Archived Team');
	});

	it('filters restricted settings pages for participant users', async () => {
		// participant mode can still reach notifications, but it should not gain broader settings destinations.
		const response = await GET(
			createEvent({ query: 'branding', userId: 'user-2', role: 'participant' })
		);
		const payload = await response.json();
		const serialized = JSON.stringify(payload.groups);

		expect(serialized).not.toContain('/dashboard/settings/branding');
		expect(serialized).not.toContain('/dashboard/settings/modules');
	});

	it('rejects weak one-word partial team matches for long team-name queries', async () => {
		// exact team-name searches should not fill the palette with teams that share only one major word.
		mocks.tenantDbOps.seasons.getByClientId.mockResolvedValue([
			{ id: 'season-1', name: 'Fall 2026', slug: 'fall-2026', isActive: 1, isCurrent: 1 }
		]);
		mocks.tenantDbOps.offerings.searchByClient.mockResolvedValue([
			{
				id: 'offering-1',
				seasonId: 'season-1',
				name: 'Basketball',
				slug: 'basketball',
				type: 'league',
				isActive: 1,
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.leagues.searchByClient.mockResolvedValue([
			{
				id: 'league-1',
				seasonId: 'season-1',
				offeringId: 'offering-1',
				name: 'Co-Rec',
				slug: 'co-rec',
				isActive: 1,
				offeringName: 'Basketball',
				offeringSlug: 'basketball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.divisions.searchByClient.mockResolvedValue([
			{
				id: 'division-1',
				leagueId: 'league-1',
				name: 'Division A',
				slug: 'division-a',
				isActive: 1,
				leagueName: 'Co-Rec',
				leagueSlug: 'co-rec',
				offeringName: 'Basketball',
				offeringSlug: 'basketball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.teams.searchByClient.mockResolvedValue([
			{
				id: 'team-1',
				divisionId: 'division-1',
				name: 'Ballers to Wallers',
				slug: 'ballers-to-wallers',
				teamStatus: 'active',
				isActive: 1,
				divisionName: 'Division A',
				divisionSlug: 'division-a',
				leagueName: 'Co-Rec',
				leagueSlug: 'co-rec',
				offeringName: 'Basketball',
				offeringSlug: 'basketball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			},
			{
				id: 'team-2',
				divisionId: 'division-1',
				name: 'Wallers United',
				slug: 'wallers-united',
				teamStatus: 'active',
				isActive: 1,
				divisionName: 'Division A',
				divisionSlug: 'division-a',
				leagueName: 'Co-Rec',
				leagueSlug: 'co-rec',
				offeringName: 'Basketball',
				offeringSlug: 'basketball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			},
			{
				id: 'team-3',
				divisionId: 'division-1',
				name: 'Ballers United',
				slug: 'ballers-united',
				teamStatus: 'active',
				isActive: 1,
				divisionName: 'Division A',
				divisionSlug: 'division-a',
				leagueName: 'Co-Rec',
				leagueSlug: 'co-rec',
				offeringName: 'Basketball',
				offeringSlug: 'basketball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);

		const response = await GET(
			createEvent({
				query: 'ballers to wallers',
				season: 'fall-2026',
				userId: 'user-1',
				role: 'admin'
			})
		);
		const payload = await response.json();
		const teamGroup = payload.groups.find(
			(group: { category: string }) => group.category === 'teams'
		);

		expect(response.status).toBe(200);
		expect(teamGroup?.items.map((item: { title: string }) => item.title)).toEqual([
			'Ballers to Wallers'
		]);
	});

	it('deep-links team-name results to the nested team page url', async () => {
		// team matches should land directly on the team route rather than opening only the parent league page.
		mocks.tenantDbOps.seasons.getByClientId.mockResolvedValue([
			{ id: 'season-1', name: 'Fall 2026', slug: 'fall-2026', isActive: 1, isCurrent: 1 }
		]);
		mocks.tenantDbOps.offerings.searchByClient.mockResolvedValue([
			{
				id: 'offering-1',
				seasonId: 'season-1',
				name: 'Soccer',
				slug: 'soccer',
				type: 'league',
				isActive: 1,
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.leagues.searchByClient.mockResolvedValue([
			{
				id: 'league-1',
				seasonId: 'season-1',
				offeringId: 'offering-1',
				name: 'Co-Rec',
				slug: 'co-rec',
				isActive: 1,
				offeringName: 'Soccer',
				offeringSlug: 'soccer',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.divisions.searchByClient.mockResolvedValue([
			{
				id: 'division-1',
				leagueId: 'league-1',
				name: 'Division A',
				slug: 'division-a',
				isActive: 1,
				leagueName: 'Co-Rec',
				leagueSlug: 'co-rec',
				offeringName: 'Soccer',
				offeringSlug: 'soccer',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.teams.searchByClient.mockResolvedValue([
			{
				id: 'team-1',
				divisionId: 'division-1',
				name: 'Soccer Stars',
				slug: 'soccer-stars',
				teamStatus: 'active',
				isActive: 1,
				divisionName: 'Division A',
				divisionSlug: 'division-a',
				leagueName: 'Co-Rec',
				leagueSlug: 'co-rec',
				offeringName: 'Soccer',
				offeringSlug: 'soccer',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);

		const response = await GET(
			createEvent({
				query: 'soccer stars',
				season: 'fall-2026',
				userId: 'user-1',
				role: 'admin'
			})
		);
		const payload = await response.json();
		const teamGroup = payload.groups.find(
			(group: { category: string }) => group.category === 'teams'
		);

		expect(response.status).toBe(200);
		expect(teamGroup?.items[0]?.href).toBe(
			'/dashboard/offerings/fall-2026/soccer/co-rec/division-a/soccer-stars'
		);
		expect(teamGroup?.items[0]?.subtitle).toBe('Soccer • Co-Rec • Division A');
	});

	it('prioritizes team results over division results for exact team-name matches', async () => {
		// enter-to-open should select the team destination first when both team and division are close matches.
		mocks.tenantDbOps.seasons.getByClientId.mockResolvedValue([
			{ id: 'season-1', name: 'Fall 2026', slug: 'fall-2026', isActive: 1, isCurrent: 1 }
		]);
		mocks.tenantDbOps.offerings.searchByClient.mockResolvedValue([
			{
				id: 'offering-1',
				seasonId: 'season-1',
				name: 'Basketball',
				slug: 'basketball',
				type: 'league',
				isActive: 1,
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.leagues.searchByClient.mockResolvedValue([
			{
				id: 'league-1',
				seasonId: 'season-1',
				offeringId: 'offering-1',
				name: 'Mens Competitive',
				slug: 'mens-competitive',
				isActive: 1,
				offeringName: 'Basketball',
				offeringSlug: 'basketball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.divisions.searchByClient.mockResolvedValue([
			{
				id: 'division-1',
				leagueId: 'league-1',
				name: 'Wildcats',
				slug: 'wildcats-division',
				isActive: 1,
				leagueName: 'Mens Competitive',
				leagueSlug: 'mens-competitive',
				offeringName: 'Basketball',
				offeringSlug: 'basketball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);
		mocks.tenantDbOps.teams.searchByClient.mockResolvedValue([
			{
				id: 'team-1',
				divisionId: 'division-1',
				name: 'Wildcats',
				slug: 'wildcats',
				teamStatus: 'active',
				isActive: 1,
				divisionName: 'Wildcats',
				divisionSlug: 'wildcats-division',
				leagueName: 'Mens Competitive',
				leagueSlug: 'mens-competitive',
				offeringName: 'Basketball',
				offeringSlug: 'basketball',
				seasonName: 'Fall 2026',
				seasonSlug: 'fall-2026'
			}
		]);

		const response = await GET(
			createEvent({
				query: 'wildcats',
				season: 'fall-2026',
				userId: 'user-1',
				role: 'admin'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.groups[0]?.category).toBe('teams');
		expect(payload.groups[0]?.items[0]?.href).toBe(
			'/dashboard/offerings/fall-2026/basketball/mens-competitive/wildcats-division/wildcats'
		);
	});

	it('returns recents without shortcuts when no query is provided', async () => {
		// the empty state should stay focused on user history and cap the visible list to a manageable size.
		mocks.centralDbOps.searchRecents.listByUserAndClient.mockResolvedValue(
			Array.from({ length: 10 }, (_, index) => ({
				id: `recent-${index + 1}`,
				resultKey: `pages:/dashboard/facilities/${index + 1}`,
				category: 'recent',
				title: `Recent ${index + 1}`,
				subtitle: 'Recent page',
				href: `/dashboard/facilities/${index + 1}`,
				badge: 'Recent',
				meta: null
			}))
		);

		const response = await GET(createEvent({ userId: 'user-3', role: 'admin' }));
		const payload = await response.json();
		const categories = payload.groups.map((group: { category: string }) => group.category);
		const recentGroup = payload.groups.find(
			(group: { category: string }) => group.category === 'recent'
		);

		expect(categories).toContain('recent');
		expect(categories).not.toContain('shortcuts');
		expect(recentGroup?.items).toHaveLength(8);
		expect(recentGroup?.items[0]?.title).toBe('Recent 1');
		expect(recentGroup?.items[7]?.title).toBe('Recent 8');
	});
});
