/*
Brief description:
This file verifies the pure helper logic that powers the shared date picker.

Deeper explanation:
The new picker will replace native date and datetime-local inputs across the app, so the risky part
is the shared parsing and calendar math rather than the route wiring. These tests lock the ISO
serialization contract, the six-row calendar grid shape, min/max disabling, month navigation
clamping, and the shortcut behavior that preserves time for datetime-local values.

Summary of tests:
1. It verifies date and datetime-local values parse and serialize back to the expected ISO shape.
2. It verifies invalid values are rejected instead of being silently normalized.
3. It verifies the month grid always renders forty-two cells with adjacent-month padding.
4. It verifies min and max bounds disable out-of-range day cells.
5. It verifies month navigation clamps to the allowed month range.
6. It verifies date shortcuts use the current day while preserving datetime-local time.
7. It verifies date selection merges with an existing or fallback time for datetime-local values.
*/

import { describe, expect, it } from 'vitest';

import {
	buildCalendarGrid,
	buildShortcutValue,
	clampPickerValue,
	mergeDateKeyWithValue,
	parsePickerValue,
	serializePickerValue,
	shiftMonthReference,
	type DatePickerType
} from '../../src/lib/components/date-picker';

function expectRoundTrip(value: string, type: DatePickerType): void {
	const parsed = parsePickerValue(value, type);
	expect(parsed).not.toBeNull();
	expect(serializePickerValue(parsed!, type)).toBe(value);
}

describe('date-picker helpers', () => {
	it('round-trips valid date values', () => {
		expectRoundTrip('2026-04-08', 'date');
	});

	it('round-trips valid datetime-local values', () => {
		expectRoundTrip('2026-04-08T14:35', 'datetime-local');
	});

	it('rejects invalid values instead of coercing them', () => {
		expect(parsePickerValue('2026-02-30', 'date')).toBeNull();
		expect(parsePickerValue('2026-04-08T25:10', 'datetime-local')).toBeNull();
	});

	it('builds a six-row month grid with adjacent-month padding', () => {
		const grid = buildCalendarGrid(
			{ year: 2024, month: 4 },
			{ value: '2024-04-24', type: 'date', today: '2024-04-08' }
		);

		expect(grid).toHaveLength(42);
		expect(grid[0]).toMatchObject({
			dateKey: '2024-03-31',
			isCurrentMonth: false,
			monthOffset: -1
		});
		expect(grid[24]).toMatchObject({
			dateKey: '2024-04-24',
			isCurrentMonth: true,
			isSelected: true
		});
		expect(grid[41]).toMatchObject({
			dateKey: '2024-05-11',
			isCurrentMonth: false,
			monthOffset: 1
		});
	});

	it('disables days outside the allowed bounds', () => {
		const grid = buildCalendarGrid(
			{ year: 2026, month: 4 },
			{
				value: '2026-04-18',
				type: 'date',
				min: '2026-04-10',
				max: '2026-04-20'
			}
		);

		const aprilNinth = grid.find((cell) => cell.dateKey === '2026-04-09');
		const aprilTenth = grid.find((cell) => cell.dateKey === '2026-04-10');
		const aprilTwentyFirst = grid.find((cell) => cell.dateKey === '2026-04-21');

		expect(aprilNinth?.isDisabled).toBe(true);
		expect(aprilTenth?.isDisabled).toBe(false);
		expect(aprilTwentyFirst?.isDisabled).toBe(true);
	});

	it('clamps month navigation to the min and max month range', () => {
		expect(
			shiftMonthReference(
				{ year: 2026, month: 4 },
				-2,
				'date',
				'2026-03-10',
				'2026-08-22'
			)
		).toEqual({ year: 2026, month: 3 });

		expect(
			shiftMonthReference(
				{ year: 2026, month: 7 },
				2,
				'date',
				'2026-03-10',
				'2026-08-22'
			)
		).toEqual({ year: 2026, month: 8 });
	});

	it('builds yesterday, today, and tomorrow shortcuts relative to the current day', () => {
		const now = new Date(2026, 3, 8, 16, 12, 0, 0);

		expect(buildShortcutValue('2025-01-01', 'date', 'today', now)).toBe('2026-04-08');
		expect(buildShortcutValue('2025-01-01', 'date', 'yesterday', now)).toBe('2026-04-07');
		expect(buildShortcutValue('2025-01-01', 'date', 'tomorrow', now)).toBe('2026-04-09');
		expect(buildShortcutValue('2025-01-01T09:45', 'datetime-local', 'today', now)).toBe(
			'2026-04-08T09:45'
		);
	});

	it('merges a selected date with an existing or fallback time for datetime-local values', () => {
		const now = new Date(2026, 3, 8, 16, 12, 0, 0);

		expect(mergeDateKeyWithValue('2026-05-01', '2026-04-08T09:45', 'datetime-local', now)).toBe(
			'2026-05-01T09:45'
		);
		expect(mergeDateKeyWithValue('2026-05-01', '', 'datetime-local', now)).toBe(
			'2026-05-01T16:12'
		);
	});

	it('clamps datetime-local values to the allowed range when they are valid ISO values', () => {
		expect(
			clampPickerValue(
				'2026-04-08T07:30',
				'datetime-local',
				'2026-04-08T09:00',
				'2026-04-08T17:00'
			)
		).toBe('2026-04-08T09:00');
		expect(
			clampPickerValue(
				'2026-04-08T18:15',
				'datetime-local',
				'2026-04-08T09:00',
				'2026-04-08T17:00'
			)
		).toBe('2026-04-08T17:00');
	});
});
