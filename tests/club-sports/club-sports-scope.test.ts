/*
Brief description:
This file verifies the helper functions that resolve club sports seasons, clubs, leagues, and teams by slug.

Deeper explanation:
Club sports deliberately reuse the same dashboard navigation feel as intramurals, but their data hierarchy is
different because teams hang directly off leagues and leadership can exist at both club and team scope. These
tests lock the shared slug and lookup behavior so route loads and APIs can safely resolve records without
depending on intramural division logic.

Summary of tests:
1. It verifies that club sports slug normalization stays stable for mixed punctuation and spacing.
2. It verifies that club navigation options stay scoped to the selected club season.
3. It verifies that club resolution prefers the matching season-scoped club slug.
4. It verifies that league and team resolution stay within the selected club and league.
*/

import { describe, expect, it, vi } from 'vitest';

import {
	buildSeasonScopedClubOptions,
	normalizeClubSportsSlug,
	resolveClubForSeason,
	resolveClubLeagueForClub,
	resolveClubTeamForLeague
} from '../../src/lib/server/club-sports-scope';

describe('club sports scope helpers', () => {
	it('normalizes club sport slugs consistently', () => {
		// this keeps route params stable even when club names contain punctuation or repeated spacing.
		expect(normalizeClubSportsSlug(' "Women\'s Ice Hockey!" ')).toBe('womens-ice-hockey');
	});

	it('builds club navigation options only for the requested season', () => {
		// this prevents the season breadcrumb dropdown from leaking clubs from other club seasons.
		expect(
			buildSeasonScopedClubOptions({
				season: { id: 'season-1', slug: '2026-2027' },
				clubs: [
					{ id: 'club-1', clubSeasonId: 'season-1', name: 'Ice Hockey', slug: 'ice-hockey' },
					{ id: 'club-2', clubSeasonId: 'season-2', name: 'Rowing', slug: 'rowing' }
				]
			})
		).toEqual([{ label: 'Ice Hockey', href: '/dashboard/clubs/2026-2027/ice-hockey' }]);
	});

	it('resolves a club by season and slug', async () => {
		// this mirrors the route load behavior when a season slug is correct but clubs are fetched broadly.
		const dbOps = {
			clubSportsClubs: {
				getByClientIdSeasonIdAndSlug: vi.fn().mockResolvedValue(null),
				getByClientId: vi.fn().mockResolvedValue([
					{ id: 'club-1', clubSeasonId: 'season-1', name: 'Ice Hockey', slug: 'ice-hockey' },
					{ id: 'club-2', clubSeasonId: 'season-2', name: 'Ice Hockey', slug: 'ice-hockey' }
				])
			}
		} as any;

		const resolved = await resolveClubForSeason(dbOps, 'client-1', { id: 'season-1' } as any, 'Ice Hockey');

		expect(resolved?.id).toBe('club-1');
	});

	it('resolves leagues and teams within the selected club hierarchy', async () => {
		// this keeps descendant route lookups isolated to the club branch instead of crossing into other clubs.
		const dbOps = {
			clubSportsLeagues: {
				getByClubIdAndSlug: vi.fn().mockResolvedValue(null),
				getByClubId: vi.fn().mockResolvedValue([
					{ id: 'league-1', clubId: 'club-1', name: "Women's League", slug: 'womens-league' }
				])
			},
			clubSportsTeams: {
				getByLeagueIdAndSlug: vi.fn().mockResolvedValue(null),
				getByLeagueId: vi.fn().mockResolvedValue([
					{ id: 'team-1', clubLeagueId: 'league-1', name: 'D1 Team', slug: 'd1-team' }
				])
			}
		} as any;

		const league = await resolveClubLeagueForClub(
			dbOps,
			{ id: 'club-1', slug: 'ice-hockey' } as any,
			"Women's League"
		);
		const team = await resolveClubTeamForLeague(dbOps, { id: 'league-1' } as any, 'D1 Team');

		expect(league?.id).toBe('league-1');
		expect(team?.id).toBe('team-1');
	});
});
