/*
Brief description:
This file verifies the shared date tooltip display format.

Deeper explanation:
DateHoverText delegates to this formatter, so one change updates all its consumers.
Local dates keep these assertions independent of the machine's timezone.

Summary of tests:
1. It verifies that single-digit days have no leading zero.
2. It verifies that morning and afternoon times include a space before AM or PM.
3. It verifies that both endpoints of a range use the same format.
4. It verifies that tooltip precision matches the visible date or datetime.
*/

import { describe, expect, it } from 'vitest';
import { buildDateTooltipText } from '../../src/lib/utils/date-tooltip';

describe('date tooltip formatting', () => {
	it('shows a timestamp when a date-only value is displayed as a datetime', () => {
		// offerings renders these legacy values with new date, which interprets them as utc.
		const value = '2027-04-04';
		const date = new Date(value);
		const display = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
		expect(buildDateTooltipText({ value, display })).toBe(
			buildDateTooltipText({ value: date, includeTime: true })
		);
	});

	it('omits stored time when the visible label is date-only', () => {
		expect(
			buildDateTooltipText({
				value: new Date(2026, 9, 4, 16, 7),
				display: 'Oct 4',
				includeTime: true
			})
		).toBe('Sunday, October 4, 2026');
	});

	it('includes time for visible datetime labels without an explicit flag', () => {
		expect(
			buildDateTooltipText({
				value: new Date(2026, 9, 4, 16, 7),
				display: 'Oct 4, 4:07 PM'
			})
		).toContain('4:07 PM');
	});
	it('omits the leading zero from single-digit days', () => {
		expect(buildDateTooltipText({ value: '2026-10-04' })).toBe('Sunday, October 4, 2026');
	});

	it.each([
		[4, '4:07 AM'],
		[16, '4:07 PM']
	] as const)('spaces the day period for hour %i', (hour, time) => {
		// local construction isolates formatting from utc conversion and timezone abbreviations.
		const text = buildDateTooltipText({ value: new Date(2026, 9, 4, hour, 7) });
		expect(text).toContain(`Sunday, October 4, 2026, ${time} `);
	});

	it('formats both range endpoints consistently', () => {
		expect(buildDateTooltipText({ value: '2026-10-04', endValue: '2026-10-05' })).toBe(
			'Sunday, October 4, 2026 - Monday, October 5, 2026'
		);
	});
});
