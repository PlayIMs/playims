/*
Brief description:
This file verifies the shared helpers that backfill offering series ids and group previous offerings.

Deeper explanation:
Offerings can now span multiple seasons through a shared series id, but older data may still have
same-name offerings that were created before that feature existed. These tests protect both the
retroactive backfill plan and the wizard-facing grouping logic that should show one previous offering
choice per linked cross-season series instead of one row per season.

Summary of tests:
1. It verifies that same-name offerings without series ids receive one shared backfilled series id.
2. It verifies that same-name offerings with mixed series ids converge on one retained series id.
3. It verifies that previous offering link choices group linked seasons into a single representative option.
*/

import { describe, expect, it } from 'vitest';

import {
	buildOfferingSeriesBackfillPlan,
	buildPreviousOfferingLinkChoices
} from '../../src/lib/utils/offering-linking';

describe('offering linking utilities', () => {
	it('assigns one shared backfilled series id to same-name offerings without links', () => {
		// older data can have multiple seasons of the same offering with no series id yet.
		const updates = buildOfferingSeriesBackfillPlan(
			[
				{ id: 'offering-1', name: 'Basketball', seriesId: null },
				{ id: 'offering-2', name: 'Basketball', seriesId: '' },
				{ id: 'offering-3', name: 'Volleyball', seriesId: null }
			],
			() => 'series-new'
		);

		expect(updates).toEqual([
			{ offeringId: 'offering-1', seriesId: 'series-new' },
			{ offeringId: 'offering-2', seriesId: 'series-new' }
		]);
	});

	it('reuses an existing series id when same-name offerings were partially linked already', () => {
		// the retained series id should come from the data when one already exists.
		const updates = buildOfferingSeriesBackfillPlan(
			[
				{ id: 'offering-1', name: 'Basketball', seriesId: 'series-1' },
				{ id: 'offering-2', name: 'Basketball', seriesId: null },
				{ id: 'offering-3', name: 'Basketball', seriesId: 'series-2' }
			],
			() => 'series-new'
		);

		expect(updates).toEqual([
			{ offeringId: 'offering-2', seriesId: 'series-1' },
			{ offeringId: 'offering-3', seriesId: 'series-1' }
		]);
	});

	it('groups previous linked seasons into one wizard choice', () => {
		// once offerings share a series id, the wizard should treat them as one previous offering.
		const choices = buildPreviousOfferingLinkChoices({
			seasons: [
				{ id: 'season-1', name: 'Spring 2025', startDate: '2025-03-01' },
				{ id: 'season-2', name: 'Fall 2025', startDate: '2025-09-01' },
				{ id: 'season-3', name: 'Spring 2026', startDate: '2026-03-01' }
			],
			offerings: [
				{
					id: 'offering-1',
					name: 'Basketball',
					slug: 'basketball',
					seasonId: 'season-1',
					seasonName: 'Spring 2025',
					seriesId: 'series-basketball',
					isActive: true
				},
				{
					id: 'offering-2',
					name: 'Basketball',
					slug: 'basketball',
					seasonId: 'season-2',
					seasonName: 'Fall 2025',
					seriesId: 'series-basketball',
					isActive: true
				},
				{
					id: 'offering-3',
					name: 'Basketball',
					slug: 'basketball',
					seasonId: 'season-3',
					seasonName: 'Spring 2026',
					seriesId: null,
					isActive: true
				}
			],
			selectedSeasonId: 'season-3',
			offeringName: 'Basketball',
			offeringSlug: 'basketball'
		});

		expect(choices).toEqual([
			{
				id: 'offering-2',
				name: 'Basketball',
				slug: 'basketball',
				seriesId: 'series-basketball',
				seasonId: 'season-2',
				seasonName: 'Fall 2025',
				seasonNames: ['Spring 2025', 'Fall 2025'],
				seasonCount: 2
			}
		]);
	});
});
