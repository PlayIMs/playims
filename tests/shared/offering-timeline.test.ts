/*
Brief description:
This file verifies the shared offering timeline helpers that decide when an offering actually concludes.

Deeper explanation:
The offerings page groups active and concluded offerings based on league end dates. That logic must stay
aligned with postseason behavior so an offering does not move into the concluded section before playoffs
are finished. These tests lock down the shared timeline contract directly so future refactors do not
accidentally ignore postseason dates or change the display-only season range behavior.

Summary of tests:
1. It verifies that postseason end dates override regular season end dates when postseason exists.
2. It verifies that regular season end dates still drive conclusion when no postseason is configured.
3. It verifies that missing or invalid dates do not falsely mark an offering as concluded.
4. It verifies that the effective end timestamp helper stays aligned with the same conclusion rule.
*/

import { describe, expect, it } from 'vitest';
import {
	getEffectiveOfferingEndDate,
	getEffectiveOfferingEndMs,
	isOfferingTimelineConcluded
} from '../../src/lib/utils/offering-timeline';

describe('offering timeline helpers', () => {
	it('uses postseason end dates before regular season end dates when postseason exists', () => {
		// this protects the real bug where an offering looked concluded after the regular season
		// even though its postseason was still ongoing.
		const timeline = {
			seasonEnd: '2026-03-18T19:00:00',
			hasPostseason: true,
			postseasonEnd: '2026-03-28T21:00:00'
		};

		expect(getEffectiveOfferingEndDate(timeline)).toBe('2026-03-28T21:00:00');
		expect(
			isOfferingTimelineConcluded(timeline, new Date('2026-03-20T12:00:00'))
		).toBe(false);
		expect(
			isOfferingTimelineConcluded(timeline, new Date('2026-03-29T12:00:00'))
		).toBe(true);
	});

	it('falls back to the regular season end date when postseason is disabled or missing', () => {
		// this keeps standard offerings working exactly as before when there is no postseason.
		expect(
			getEffectiveOfferingEndDate({
				seasonEnd: '2026-03-18T19:00:00',
				hasPostseason: false,
				postseasonEnd: '2026-03-28T21:00:00'
			})
		).toBe('2026-03-18T19:00:00');

		expect(
			getEffectiveOfferingEndDate({
				seasonEnd: '2026-03-18T19:00:00',
				hasPostseason: true,
				postseasonEnd: null
			})
		).toBe('2026-03-18T19:00:00');
	});

	it('does not mark offerings concluded when the effective end date is missing or invalid', () => {
		// this prevents bad or partially entered data from silently pushing offerings into history.
		expect(
			isOfferingTimelineConcluded(
				{
					seasonEnd: null,
					hasPostseason: false,
					postseasonEnd: null
				},
				new Date('2026-03-20T12:00:00')
			)
		).toBe(false);

		expect(
			isOfferingTimelineConcluded(
				{
					seasonEnd: 'not-a-date',
					hasPostseason: true,
					postseasonEnd: 'also-not-a-date'
				},
				new Date('2026-03-20T12:00:00')
			)
		).toBe(false);
	});

	it('returns the same effective timestamp that the conclusion rule uses', () => {
		// this keeps sorting behavior aligned with the same postseason-aware end date decision.
		const postseasonMs = new Date('2026-03-28T21:00:00').getTime();
		expect(
			getEffectiveOfferingEndMs({
				seasonEnd: '2026-03-18T19:00:00',
				hasPostseason: true,
				postseasonEnd: '2026-03-28T21:00:00'
			})
		).toBe(postseasonMs);

		expect(
			getEffectiveOfferingEndMs(
				{
					seasonEnd: null,
					hasPostseason: false,
					postseasonEnd: null
				},
				-1
			)
		).toBe(-1);
	});
});
