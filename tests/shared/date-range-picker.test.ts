/*
Brief description:
This file verifies the pure helper logic that powers the shared date range picker.

Deeper explanation:
The range picker reuses the shared calendar grid, but it adds its own state rules for keeping
start and end dates valid, deciding which boundary changes after a click, and deciding which two
months should be visible together. These tests protect that range-specific logic so the schedule
page can adopt the shared picker without relying on route-local date math.

Summary of tests:
1. It verifies invalid or reversed range values normalize into a valid ordered start and end date.
2. It verifies selecting a date updates only the targeted range boundary while preserving order.
3. It verifies the active boundary follows the selected date when a selection crosses the current range.
4. It verifies the start and end calendars resolve independently from their own boundary dates.
5. It verifies range-aware calendar grids mark the start, end, and in-range dates distinctly.
*/

import { describe, expect, it } from 'vitest';

import { buildCalendarGrid } from '../../src/lib/components/date-picker';
import {
	resolveDateRangeCalendarMonths,
	normalizeDateRangeValue,
	resolveDateRangeSelection,
	resolveDateRangeSelectionState
} from '../../src/lib/components/date-range-picker';

describe('date-range-picker helpers', () => {
	it('normalizes invalid and reversed range values into an ordered range', () => {
		expect(normalizeDateRangeValue('2026-04-20', '2026-04-08')).toEqual({
			startDate: '2026-04-08',
			endDate: '2026-04-20'
		});
		expect(normalizeDateRangeValue('', '2026-04-08', '2026-04-05')).toEqual({
			startDate: '2026-04-05',
			endDate: '2026-04-08'
		});
	});

	it('updates only the targeted boundary when selecting a date', () => {
		const currentRange = {
			startDate: '2026-04-08',
			endDate: '2026-04-20'
		};

		expect(resolveDateRangeSelection(currentRange, '2026-04-03', 'start')).toEqual({
			startDate: '2026-04-03',
			endDate: '2026-04-20'
		});
		expect(resolveDateRangeSelection(currentRange, '2026-04-25', 'end')).toEqual({
			startDate: '2026-04-08',
			endDate: '2026-04-25'
		});

		// selecting across the current range still keeps the result ordered.
		expect(resolveDateRangeSelection(currentRange, '2026-04-30', 'start')).toEqual({
			startDate: '2026-04-20',
			endDate: '2026-04-30'
		});
	});

	it('moves the active boundary with the selected date when a selection crosses the current range', () => {
		expect(
			resolveDateRangeSelectionState(
				{
					startDate: '2026-04-08',
					endDate: '2026-04-20'
				},
				'2026-04-30',
				'start'
			)
		).toEqual({
			startDate: '2026-04-20',
			endDate: '2026-04-30',
			activeBoundary: 'end'
		});

		expect(
			resolveDateRangeSelectionState(
				{
					startDate: '2026-04-08',
					endDate: '2026-04-20'
				},
				'2026-04-03',
				'end'
			)
		).toEqual({
			startDate: '2026-04-03',
			endDate: '2026-04-08',
			activeBoundary: 'start'
		});
	});

	it('resolves the start and end calendar months independently from their boundary dates', () => {
		expect(
			resolveDateRangeCalendarMonths('2026-01-22', '2026-01-31', '2025-01-01', '2026-12-31')
		).toEqual({
			startMonth: { year: 2026, month: 1 },
			endMonth: { year: 2026, month: 1 }
		});

		// each side clamps against the configured bounds without forcing the other calendar to shift with it.
		expect(
			resolveDateRangeCalendarMonths('2024-12-20', '2027-01-10', '2025-03-01', '2026-08-31')
		).toEqual({
			startMonth: { year: 2025, month: 3 },
			endMonth: { year: 2026, month: 8 }
		});
	});

	it('marks range boundaries and the dates inside the range on the shared calendar grid', () => {
		const grid = buildCalendarGrid(
			{ year: 2026, month: 4 },
			{
				type: 'date',
				value: '2026-04-08',
				rangeStart: '2026-04-08',
				rangeEnd: '2026-04-12'
			}
		);

		expect(grid.find((cell) => cell.dateKey === '2026-04-08')).toMatchObject({
			isRangeStart: true,
			isInRange: true
		});
		expect(grid.find((cell) => cell.dateKey === '2026-04-10')).toMatchObject({
			isInRange: true,
			isRangeStart: false,
			isRangeEnd: false
		});
		expect(grid.find((cell) => cell.dateKey === '2026-04-12')).toMatchObject({
			isRangeEnd: true,
			isInRange: true
		});
		expect(grid.find((cell) => cell.dateKey === '2026-04-14')).toMatchObject({
			isInRange: false
		});
	});
});
