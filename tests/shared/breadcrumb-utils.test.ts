/*
Brief description:
This file verifies the pure helpers that keep breadcrumb links aligned with the viewed season.

Deeper explanation:
The breadcrumb component now needs to preserve an optional `?season=` query when a user is viewing a
non-current season. These tests lock the URL-shaping and label-display helpers so route links and
dropdown actions keep the same season context instead of silently snapping back to the org current
season. They also protect the rule that only the rightmost label can become a dropdown trigger.

Summary of tests:
1. It verifies that season query params are appended and replace older season values.
2. It verifies that non-season query params and hashes are preserved when season context is added.
3. It verifies that only non-root breadcrumb labels show the season context suffix.
4. It verifies that only the rightmost label with an available menu opens a dropdown.
*/

import { describe, expect, it } from 'vitest';
import {
	appendSeasonQueryToBreadcrumbHref,
	shouldShowBreadcrumbSeasonContext,
	shouldOpenBreadcrumbMenuFromLabel
} from '../../src/lib/components/navigation/breadcrumb-utils';

describe('breadcrumb utils', () => {
	it('opens a menu from the rightmost label only when a menu is available', () => {
		// earlier labels must remain links even when they have their own arrow menus.
		expect(shouldOpenBreadcrumbMenuFromLabel(2, 3, true)).toBe(true);
		expect(shouldOpenBreadcrumbMenuFromLabel(1, 3, true)).toBe(false);
		expect(shouldOpenBreadcrumbMenuFromLabel(0, 3, true)).toBe(false);
		expect(shouldOpenBreadcrumbMenuFromLabel(2, 3, false)).toBe(false);
		// a single visible crumb is still the rightmost crumb.
		expect(shouldOpenBreadcrumbMenuFromLabel(0, 1, true)).toBe(true);
	});
	it('adds or replaces the viewed season query on breadcrumb hrefs', () => {
		// the viewed season should stay sticky even when the base link already has an older season query.
		expect(
			appendSeasonQueryToBreadcrumbHref('/dashboard/offerings', {
				seasonSlug: 'spring-2026',
				includeSeasonQuery: true
			})
		).toBe('/dashboard/offerings?season=spring-2026');
		expect(
			appendSeasonQueryToBreadcrumbHref('/dashboard/offerings?season=fall-2026', {
				seasonSlug: 'spring-2026',
				includeSeasonQuery: true
			})
		).toBe('/dashboard/offerings?season=spring-2026');
	});

	it('preserves unrelated query params and hashes when adding season context', () => {
		// other page state should survive when the viewed season is carried across tab navigation.
		expect(
			appendSeasonQueryToBreadcrumbHref('/dashboard/offerings?view=leagues#details', {
				seasonSlug: 'spring-2026',
				includeSeasonQuery: true
			})
		).toBe('/dashboard/offerings?view=leagues&season=spring-2026#details');
	});

	it('shows season context only for non-root breadcrumb labels', () => {
		// the root offerings tab keeps its plain label, while nested records show the viewed season badge.
		expect(shouldShowBreadcrumbSeasonContext('offerings', true)).toBe(false);
		expect(shouldShowBreadcrumbSeasonContext('offering', true)).toBe(true);
		expect(shouldShowBreadcrumbSeasonContext('team', false)).toBe(false);
	});
});
