/*
Brief description:
This file verifies the intramural New Season wizard's seasonal suggestions and layout wiring.

Deeper explanation:
Suggestions use the user's local calendar month, not the academic-year label used by club seasons.
Boundary tests protect the March and October transitions, including the change of calendar year.

Summary of tests:
1. It verifies Spring suggestions from October through February and Fall suggestions otherwise.
2. It verifies that slug suggestions use the shared slug converter.
3. It verifies that the live wizard groups dates before the status controls.
*/
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getUpcomingSeasonName } from '../../src/lib/utils/season-defaults';
import { slugifyFinal } from '../../src/lib/components/wizard/slug-utils';

describe('new season suggestions', () => {
	it.each([
		[2026, 0, 'Spring 2026'],
		[2026, 1, 'Spring 2026'],
		[2026, 2, 'Fall 2026'],
		[2026, 8, 'Fall 2026'],
		[2026, 9, 'Spring 2027'],
		[2026, 11, 'Spring 2027'],
		[2027, 0, 'Spring 2027']
	])('suggests the appropriate upcoming term for %i, month index %i', (year, month, expected) => {
		// local constructors avoid utc conversion moving a boundary into the previous month.
		const name = getUpcomingSeasonName(new Date(Number(year), Number(month), 1, 12));
		expect(name).toBe(expected);
		expect(slugifyFinal(name)).toBe(String(expected).toLowerCase().replace(' ', '-'));
	});
	it('uses seasonal placeholders and keeps dates before the toggles in the live wizard', () => {
		const route = readFileSync('src/routes/dashboard/offerings/+page.svelte', 'utf8');
		expect(route).toContain('placeholder={seasonNamePlaceholder}');
		expect(route).toContain('placeholder={slugifyFinal(seasonNamePlaceholder)}');
		expect(route).toContain('seasonNamePlaceholder = getUpcomingSeasonName()');
		expect(route).toContain('Make Current Season');
		expect(route).toMatch(
			/data-season-date-fields[\s\S]*?season-start-date[\s\S]*?season-end-date[\s\S]*?data-season-status-fields/
		);
	});
});
