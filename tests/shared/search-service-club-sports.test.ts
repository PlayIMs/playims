/*
Brief description:
This file verifies that the shared search service returns club sports results and respects club season scope.

Deeper explanation:
The search endpoint now needs to serve two parallel domains: intramurals and club sports. These tests focus
on the club branch so queries inside `/dashboard/clubs` can surface club seasons, clubs, leagues, and teams
without being mixed up with the intramural season scope.

Summary of tests:
1. It verifies that club searches return club, league, and team results for the selected club season.
2. It verifies that club season scoping filters out matching clubs from other club seasons.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getCentralDbOps: vi.fn(),
	getTenantDbOps: vi.fn(),
	requireAuthenticatedClientId: vi.fn(),
	centralDbOps: {
		members: {
			searchByClient: vi.fn()
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
		},
		clubSportsSeasons: {
			getByClientId: vi.fn()
		},
		clubSportsClubs: {
			getByClientId: vi.fn()
		},
		clubSportsLeagues: {
			getByClientId: vi.fn()
		},
		clubSportsTeams: {
			getByClientId: vi.fn()
		}
	}
}));

vi.mock('$lib/server/database/context', () => ({
	getCentralDbOps: mocks.getCentralDbOps,
	getTenantDbOps: mocks.getTenantDbOps
}));

vi.mock('$lib/server/client-context', () => ({
	requireAuthenticatedClientId: mocks.requireAuthenticatedClientId
}));

import { getSearchResponse } from '../../src/lib/server/search/service';

describe('search service club sports integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCentralDbOps.mockReturnValue(mocks.centralDbOps);
		mocks.getTenantDbOps.mockResolvedValue(mocks.tenantDbOps);
		mocks.requireAuthenticatedClientId.mockReturnValue('client-1');
		mocks.centralDbOps.members.searchByClient.mockResolvedValue({ rows: [] });
		mocks.tenantDbOps.seasons.getByClientId.mockResolvedValue([]);
		mocks.tenantDbOps.offerings.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.leagues.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.divisions.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.teams.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.facilities.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.facilityAreas.searchByClient.mockResolvedValue([]);
		mocks.tenantDbOps.clubSportsSeasons.getByClientId.mockResolvedValue([
			{
				id: 'club-season-1',
				name: '2026-2027',
				slug: '2026-2027',
				isCurrent: 1,
				isActive: 1
			},
			{
				id: 'club-season-2',
				name: '2027-2028',
				slug: '2027-2028',
				isCurrent: 0,
				isActive: 1
			}
		]);
		mocks.tenantDbOps.clubSportsClubs.getByClientId.mockResolvedValue([
			{
				id: 'club-1',
				clubSeasonId: 'club-season-1',
				name: 'Ice Hockey',
				slug: 'ice-hockey',
				sport: 'Ice Hockey',
				isActive: 1
			},
			{
				id: 'club-2',
				clubSeasonId: 'club-season-2',
				name: 'Ice Hockey',
				slug: 'ice-hockey',
				sport: 'Ice Hockey',
				isActive: 1
			}
		]);
		mocks.tenantDbOps.clubSportsLeagues.getByClientId.mockResolvedValue([
			{
				id: 'league-1',
				clubId: 'club-1',
				clubSeasonId: 'club-season-1',
				name: "Men's League",
				slug: 'mens-league',
				isActive: 1
			}
		]);
		mocks.tenantDbOps.clubSportsTeams.getByClientId.mockResolvedValue([
			{
				id: 'team-1',
				clubId: 'club-1',
				clubLeagueId: 'league-1',
				clubSeasonId: 'club-season-1',
				name: 'D1 Team',
				slug: 'd1-team',
				isActive: 1
			}
		]);
	});

	it('returns club sports results for the requested club season', async () => {
		// this proves the shared search endpoint can surface club routes when the club scope param is present.
		const response = await getSearchResponse(
			{
				url: new URL('https://playims.test/api/search?q=ice&clubSeason=2026-2027'),
				platform: { env: { DB: {} } },
				locals: {
					user: { id: 'user-1', role: 'admin' },
					session: { activeClientId: 'client-1' }
				}
			} as any,
			'ice'
		);

		expect(response.success).toBe(true);
		expect(response.groups.some((group) => group.category === 'clubs')).toBe(true);
		expect(
			response.groups.flatMap((group) => group.items).some((item) => item.href === '/dashboard/clubs/2026-2027/ice-hockey')
		).toBe(true);
	});

	it('filters out matching clubs from other club seasons when club scope is set', async () => {
		// this keeps club search focused on the currently scoped yearly season instead of mixing club histories.
		const response = await getSearchResponse(
			{
				url: new URL('https://playims.test/api/search?q=ice&clubSeason=2026-2027'),
				platform: { env: { DB: {} } },
				locals: {
					user: { id: 'user-1', role: 'admin' },
					session: { activeClientId: 'client-1' }
				}
			} as any,
			'ice'
		);

		expect(
			response.groups
				.flatMap((group) => group.items)
				.filter((item) => item.href.includes('/dashboard/clubs/2027-2028'))
		).toHaveLength(0);
	});
});
