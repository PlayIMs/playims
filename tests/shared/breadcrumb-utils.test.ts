/*
Brief description:
This file verifies the pure helpers that keep breadcrumb links aligned with the viewed season.

Deeper explanation:
The breadcrumb component now needs to preserve an optional `?season=` query when a user is viewing a
non-current season. These tests lock the URL-shaping and label-display helpers so route links and
dropdown actions keep the same season context instead of silently snapping back to the org current
season.

Summary of tests:
1. It verifies that season query params are appended and replace older season values.
2. It verifies that non-season query params and hashes are preserved when season context is added.
3. It verifies that only non-root breadcrumb labels show the season context suffix.
*/

import { describe, expect, it } from 'vitest';
import {
	appendSeasonQueryToBreadcrumbHref,
	shouldShowBreadcrumbSeasonContext
} from '../../src/lib/components/navigation/breadcrumb-utils';

describe('breadcrumb utils', () => {
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
