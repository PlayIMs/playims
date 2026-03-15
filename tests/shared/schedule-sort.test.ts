import { describe, expect, it } from 'vitest';

import {
	compareByDayOfWeekAndTime,
	dayOfWeekSortValue,
	timeSortValue
} from '../../src/lib/utils/schedule-sort';

describe('schedule sort utilities', () => {
	it('uses the first parsed day when sorting multi-day values', () => {
		expect(dayOfWeekSortValue('Monday-Friday')).toBeLessThan(dayOfWeekSortValue('Tuesday'));
		expect(dayOfWeekSortValue('Monday / Wednesday')).toBe(dayOfWeekSortValue('Monday'));
	});

	it('uses the first parsed time when sorting ranged or discrete multi-time values', () => {
		expect(timeSortValue('6:00 PM - 8:00 PM')).toBe(18 * 60);
		expect(timeSortValue('5:30 PM / 6:15 PM')).toBe(17 * 60 + 30);
		expect(timeSortValue('6pm-8pm')).toBe(18 * 60);
	});

	it('sorts schedule rows by day, then first time, then name', () => {
		const rows = [
			{ name: 'Friday Late', dayOfWeek: 'Friday', gameTime: '8:00 PM' },
			{ name: 'Monday Range', dayOfWeek: 'Monday-Friday', gameTime: '6:00 PM - 8:00 PM' },
			{ name: 'Monday Early', dayOfWeek: 'Monday', gameTime: '5:00 PM' }
		];

		expect([...rows].sort(compareByDayOfWeekAndTime).map((row) => row.name)).toEqual([
			'Monday Early',
			'Monday Range',
			'Friday Late'
		]);
	});
});
