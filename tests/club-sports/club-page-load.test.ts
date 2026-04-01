/*
Brief description:
This file verifies the server load behavior for the club sports route family.

Deeper explanation:
The club pages mirror the intramural offerings experience, but their descendant routes resolve through a
season -> club -> league -> team hierarchy with no divisions. These tests lock the high-level load contracts
so navigation, breadcrumbs, and schedule-first team pages remain stable as the new feature grows.

Summary of tests:
1. It verifies that the top-level club page returns season boards and timeline-friendly activity rows.
2. It verifies that the club detail page returns leagues and officer summaries for rendering.
3. It verifies that the league page returns teams and schedule rows without requiring divisions.
4. It verifies that a missing team slug redirects back to the club index.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		requireAuthenticatedClientId: vi.fn(),
		getTenantDbOps: vi.fn(),
		resolveClubForSeason: vi.fn(),
		resolveClubLeagueForClub: vi.fn(),
		resolveClubTeamForLeague: vi.fn(),
		dbOps: {
			clubSportsSeasons: {
				getByClientId: vi.fn(),
				getByClientIdAndSlug: vi.fn()
			},
			clubSportsClubs: {
				getByClientId: vi.fn()
			},
			clubSportsLeagues: {
				getByClientId: vi.fn(),
				getByClubId: vi.fn()
			},
			clubSportsTeams: {
				getByLeagueId: vi.fn()
			},
			clubSportsOfficerTitles: {
				getByClientId: vi.fn()
			},
			clubSportsOfficerAssignments: {
				getByClientId: vi.fn()
			},
			clubSportsTeamRosters: {
				getByClientIdAndTeamIds: vi.fn()
			},
			clubSportsEvents: {
				getByClientId: vi.fn()
			},
			users: {
				getByClientId: vi.fn()
			}
		}
	};
});

vi.mock('$lib/server/client-context', () => ({
	requireAuthenticatedClientId: mocks.requireAuthenticatedClientId
}));

vi.mock('$lib/server/database/context', () => ({
	getTenantDbOps: mocks.getTenantDbOps
}));

vi.mock('$lib/server/club-sports-scope', () => ({
	buildSeasonScopedClubOptions: vi.fn(({ season, clubs }) =>
		clubs
			.filter((club: { clubSeasonId?: string | null }) => club.clubSeasonId === season.id)
			.map((club: { id: string; name?: string | null; slug?: string | null }) => ({
				label: club.name?.trim() || 'Club',
				href: `/dashboard/clubs/${season.slug?.trim() || season.id}/${club.slug?.trim() || club.id}`
			}))
	),
	resolveClubForSeason: mocks.resolveClubForSeason,
	resolveClubLeagueForClub: mocks.resolveClubLeagueForClub,
	resolveClubTeamForLeague: mocks.resolveClubTeamForLeague
}));

import { load as loadClubIndex } from '../../src/routes/dashboard/clubs/+page.server';
import { load as loadClubDetail } from '../../src/routes/dashboard/clubs/[seasonSlug]/[clubSlug]/+page.server';
import { load as loadClubLeague } from '../../src/routes/dashboard/clubs/[seasonSlug]/[clubSlug]/[leagueSlug]/+page.server';
import { load as loadClubTeam } from '../../src/routes/dashboard/clubs/[seasonSlug]/[clubSlug]/[leagueSlug]/[teamSlug]/+page.server';

const createEvent = (params?: Partial<Record<string, string>>) =>
	({
		url: new URL('https://playims.test/dashboard/clubs'),
		params: {
			seasonSlug: '2026-2027',
			clubSlug: 'ice-hockey',
			leagueSlug: 'mens-league',
			teamSlug: 'd1-team',
			...(params ?? {})
		},
		platform: {
			env: {
				DB: {}
			}
		},
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role: 'admin'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role: 'admin'
			}
		}
	}) as any;

describe('club sports page loads', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireAuthenticatedClientId.mockReturnValue('client-1');
		mocks.getTenantDbOps.mockResolvedValue(mocks.dbOps);
		mocks.dbOps.clubSportsSeasons.getByClientId.mockResolvedValue([
			{
				id: 'season-1',
				name: '2026-2027',
				slug: '2026-2027',
				startDate: '2026-08-01',
				endDate: '2027-05-31',
				isCurrent: 1,
				isActive: 1
			}
		]);
		mocks.dbOps.clubSportsSeasons.getByClientIdAndSlug.mockResolvedValue({
			id: 'season-1',
			name: '2026-2027',
			slug: '2026-2027',
			startDate: '2026-08-01',
			endDate: '2027-05-31',
			isCurrent: 1,
			isActive: 1
		});
		mocks.dbOps.clubSportsClubs.getByClientId.mockResolvedValue([
			{
				id: 'club-1',
				clubSeasonId: 'season-1',
				name: 'Ice Hockey',
				slug: 'ice-hockey',
				description: 'Varsity-style club hockey.',
				sport: 'Ice Hockey',
				isActive: 1
			}
		]);
		mocks.dbOps.clubSportsLeagues.getByClientId.mockResolvedValue([
			{
				id: 'league-1',
				clubId: 'club-1',
				clubSeasonId: 'season-1',
				name: "Men's League",
				slug: 'mens-league',
				description: null,
				isActive: 1,
				isLocked: 0
			}
		]);
		mocks.dbOps.clubSportsLeagues.getByClubId.mockResolvedValue([
			{
				id: 'league-1',
				clubId: 'club-1',
				clubSeasonId: 'season-1',
				name: "Men's League",
				slug: 'mens-league',
				description: null,
				isActive: 1,
				isLocked: 0
			}
		]);
		mocks.dbOps.clubSportsTeams.getByLeagueId.mockResolvedValue([
			{
				id: 'team-1',
				clubLeagueId: 'league-1',
				clubId: 'club-1',
				name: 'D1 Team',
				slug: 'd1-team',
				description: null,
				teamColor: 'Blue',
				isActive: 1,
				createdAt: '2026-08-15T10:00:00.000Z'
			}
		]);
		mocks.dbOps.clubSportsOfficerTitles.getByClientId.mockResolvedValue([
			{ id: 'title-1', name: 'President', scope: 'club', isActive: 1 },
			{ id: 'title-2', name: 'Captain', scope: 'team', isActive: 1 }
		]);
		mocks.dbOps.clubSportsOfficerAssignments.getByClientId.mockResolvedValue([
			{
				id: 'assignment-1',
				titleId: 'title-1',
				userId: 'member-1',
				clubId: 'club-1',
				clubTeamId: null
			},
			{
				id: 'assignment-2',
				titleId: 'title-2',
				userId: 'member-1',
				clubId: 'club-1',
				clubTeamId: 'team-1'
			}
		]);
		mocks.dbOps.clubSportsTeamRosters.getByClientIdAndTeamIds.mockResolvedValue([
			{
				id: 'roster-1',
				clubTeamId: 'team-1',
				userId: 'member-1',
				rosterStatus: 'active',
				dateJoined: '2026-08-20T12:00:00.000Z',
				dateLeft: null
			}
		]);
		mocks.dbOps.clubSportsEvents.getByClientId.mockResolvedValue([
			{
				id: 'event-1',
				clubTeamId: 'team-1',
				clubLeagueId: 'league-1',
				opponentName: 'State University',
				scheduledStartAt: '2026-09-01T19:00:00.000Z',
				scheduledEndAt: '2026-09-01T21:00:00.000Z',
				status: 'scheduled',
				resultLabel: null
			}
		]);
		mocks.dbOps.users.getByClientId.mockResolvedValue([
			{
				id: 'member-1',
				firstName: 'Alex',
				lastName: 'Jordan',
				email: 'alex@playims.test'
			}
		]);
		mocks.resolveClubForSeason.mockResolvedValue({
			id: 'club-1',
			clubSeasonId: 'season-1',
			name: 'Ice Hockey',
			slug: 'ice-hockey',
			description: 'Varsity-style club hockey.',
			sport: 'Ice Hockey'
		});
		mocks.resolveClubLeagueForClub.mockResolvedValue({
			id: 'league-1',
			clubId: 'club-1',
			clubSeasonId: 'season-1',
			name: "Men's League",
			slug: 'mens-league',
			description: null
		});
		mocks.resolveClubTeamForLeague.mockResolvedValue({
			id: 'team-1',
			clubLeagueId: 'league-1',
			name: 'D1 Team',
			slug: 'd1-team',
			description: null,
			teamColor: 'Blue',
			isActive: 1,
			createdAt: '2026-08-15T10:00:00.000Z'
		});
	});

	it('returns season boards for the top-level club page', async () => {
		// this proves the clubs landing page can render season-grouped club activity cards.
		const data = await loadClubIndex(createEvent());

		expect(data.seasons).toHaveLength(1);
		expect(data.activities).toHaveLength(1);
		expect(data.activities[0].clubName).toBe('Ice Hockey');
	});

	it('returns leagues and officer summaries for the club detail page', async () => {
		// this keeps the club page ready to show league navigation and club leadership sidebars.
		const data = await loadClubDetail(createEvent());

		expect(data.club.name).toBe('Ice Hockey');
		expect(data.leagues).toHaveLength(1);
		expect(data.officers.club[0].title).toBe('President');
	});

	it('returns teams and schedule rows for the league page without divisions', async () => {
		// this locks in the division-free league contract that the club UI depends on.
		const data = await loadClubLeague(createEvent());

		expect(data.league.name).toBe("Men's League");
		expect(data.teams).toHaveLength(1);
		expect(data.schedule[0].opponentName).toBe('State University');
	});

	it('redirects back to the clubs index when the team slug is missing', async () => {
		// this mirrors the existing intramural redirect pattern for broken descendant links.
		mocks.resolveClubTeamForLeague.mockResolvedValue(null);

		await expect(loadClubTeam(createEvent({ teamSlug: 'missing-team' }))).rejects.toMatchObject({
			status: 302,
			location: '/dashboard/clubs'
		});
	});
});
