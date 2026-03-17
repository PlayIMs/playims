/*
Brief description:
This file verifies the shared offering-navigation helpers for season-scoped intramural pages.

Deeper explanation:
Nested offering pages reuse the same logic to populate the header offering dropdown. The viewed season
must stay in control of that dropdown, even when the organization has a different current season.
These tests lock the helper so the tabs stay scoped to the selected season instead of drifting back to
the org current season.

Summary of tests:
1. It verifies that only offerings from the viewed season appear in navigation options.
2. It verifies that season-scoped offering hrefs use the viewed season slug in their routes.
*/

import { describe, expect, it } from 'vitest';
import { buildSeasonScopedOfferingOptions } from '../../src/lib/server/intramural-offering-scope';

describe('intramural offering scope helpers', () => {
	it('builds offering options from the viewed season instead of the org current season', () => {
		// header dropdowns should stay aligned with the season in view, not whichever season is current.
		const options = buildSeasonScopedOfferingOptions({
			season: {
				id: 'season-spring',
				name: 'Spring 2026',
				slug: 'spring-2026'
			},
			offerings: [
				{
					id: 'offering-spring',
					name: 'Basketball',
					slug: 'basketball',
					seasonId: 'season-spring'
				},
				{
					id: 'offering-fall',
					name: 'Flag Football',
					slug: 'flag-football',
					seasonId: 'season-fall'
				}
			] as any,
			leagues: []
		});

		expect(options).toEqual([
			{
				label: 'Basketball',
				href: '/dashboard/offerings/spring-2026/basketball'
			}
		]);
	});
});
