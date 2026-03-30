/*
Brief description:
This file verifies the pure helpers that power search palette season scoping.

Deeper explanation:
Search palette now exposes a season-history scope button and must reset to the org current season every
time the palette opens. These tests protect the default-season choice, the dropdown labels, and the
season-slug lookup that turns a user selection into the API query param.

Summary of tests:
1. It verifies that the current season is chosen as the default search scope.
2. It verifies that dropdown options get the expected current, past, and future status labels.
3. It verifies that a selected season id resolves to the slug sent to search routes.
*/

import { describe, expect, it } from 'vitest';
import {
	buildSearchPaletteSeasonDropdownOptions,
	resolveSearchPaletteDefaultSeasonId,
	resolveSearchPaletteScopedSeasonSlug
} from '../../src/lib/search/season-scope';

const seasons = [
	{
		id: 'season-1',
		name: 'Spring 2026',
		slug: 'spring-2026',
		startDate: '2026-03-20',
		endDate: '2026-05-01',
		isCurrent: false,
		isActive: true
	},
	{
		id: 'season-2',
		name: 'Fall 2026',
		slug: 'fall-2026',
		startDate: '2026-09-01',
		endDate: '2026-11-15',
		isCurrent: true,
		isActive: true
	},
	{
		id: 'season-3',
		name: 'Winter 2027',
		slug: 'winter-2027',
		startDate: '2027-01-08',
		endDate: '2027-02-20',
		isCurrent: false,
		isActive: true
	}
] as const;

describe('search palette season scope helpers', () => {
	it('defaults search palette to the org current season', () => {
		// reopening the palette should always start from the org current season, not the last viewed page.
		expect(resolveSearchPaletteDefaultSeasonId(seasons)).toBe('season-2');
	});

	it('builds current, past, and future labels for the season scope dropdown', () => {
		// the scope picker should clearly explain which season is current versus historical or upcoming.
		expect(buildSearchPaletteSeasonDropdownOptions(seasons, '2026-10-01')).toEqual([
			{
				value: 'season-3',
				label: 'Winter 2027',
				statusLabel: 'FUTURE'
			},
			{
				value: 'season-2',
				label: 'Fall 2026',
				statusLabel: 'CURRENT'
			},
			{
				value: 'season-1',
				label: 'Spring 2026',
				statusLabel: 'PAST'
			}
		]);
	});

	it('resolves the selected season slug for search requests', () => {
		// the client stores ids, but the search route should receive the stable season slug.
		expect(resolveSearchPaletteScopedSeasonSlug(seasons, 'season-1')).toBe('spring-2026');
		expect(resolveSearchPaletteScopedSeasonSlug(seasons, 'missing-season')).toBeNull();
	});
});
