/*
Brief description:
This file verifies the club-season history helper used by the clubs dashboard page.

Deeper explanation:
The clubs index now follows the same season-first header behavior as offerings, so the route needs
stable rules for ordering current, future, and past seasons and for choosing which season should be
active after data refreshes. These tests keep that shared selection logic predictable without needing
to mount the Svelte page.

Summary of tests:
1. It verifies that future seasons sort before the current season and past seasons follow after it.
2. It verifies that season history labels stay aligned with current, future, and past states.
3. It verifies that the default selection prefers the current season when the previous selection is gone.
*/

import { describe, expect, it } from 'vitest';

import {
	compareClubSeasonHistoryOrder,
	resolveDefaultClubSeasonId,
	seasonStatusLabelForHistory,
	type ClubSeasonHistorySeason
} from '../../src/routes/dashboard/clubs/season-history';

const seasons: ClubSeasonHistorySeason[] = [
	{
		id: 'past',
		name: '2024-2025',
		startDate: '2024-08-01',
		isCurrent: false,
		isActive: true
	},
	{
		id: 'current',
		name: '2025-2026',
		startDate: '2025-08-01',
		isCurrent: true,
		isActive: true
	},
	{
		id: 'future',
		name: '2026-2027',
		startDate: '2026-08-01',
		isCurrent: false,
		isActive: true
	}
];

describe('club season history helper', () => {
	it('sorts future seasons ahead of current and past seasons', () => {
		// this locks the offerings-style history order the clubs page now follows.
		const sortedSeasons = [...seasons].sort((left, right) =>
			compareClubSeasonHistoryOrder(left, right, '2026-02-01')
		);

		expect(sortedSeasons.map((season) => season.id)).toEqual(['future', 'current', 'past']);
	});

	it('labels current, future, and past seasons for the history dropdown', () => {
		// these status tags are shown in the same compact history menu pattern as offerings.
		expect(seasonStatusLabelForHistory(seasons[1], '2026-02-01')).toBe('CURRENT');
		expect(seasonStatusLabelForHistory(seasons[2], '2026-02-01')).toBe('FUTURE');
		expect(seasonStatusLabelForHistory(seasons[0], '2026-02-01')).toBe('PAST');
	});

	it('falls back to the current season when the previous selection is no longer valid', () => {
		// this protects the season title after invalidations or newly loaded season lists.
		expect(resolveDefaultClubSeasonId(seasons, 'current', 'missing-season')).toBe('current');
	});
});
