/*
Brief description:
This file verifies the pure helper logic that powers the shared date picker.

Deeper explanation:
The new picker will replace native date and datetime-local inputs across the app, so the risky part
is the shared parsing and calendar math rather than the route wiring. These tests lock the ISO
serialization contract, the six-row calendar grid shape, min/max disabling, month navigation
clamping, the year-range defaults and inference, the wheel-scroll month stepping, the segmented
input selection behavior, and the shortcut behavior that preserves time for datetime-local values.

Summary of tests:
1. It verifies date and datetime-local values parse and serialize back to the expected ISO shape.
2. It verifies invalid values are rejected instead of being silently normalized.
3. It verifies the month grid always renders forty-two cells with adjacent-month padding.
4. It verifies the animated month strip keeps previous, current, and next month references in order.
5. It verifies min and max bounds disable out-of-range day cells.
6. It verifies month navigation clamps to the allowed month range.
7. It verifies year ranges default to the current year through ten years ahead.
8. It verifies inferred year ranges expand to include contextual values and caller overrides.
9. It verifies wheel scrolling accumulates toward a single previous or next month shift per gesture.
10. It verifies new wheel gestures reset after a pause or direction change.
11. It verifies keyboard calendar movement resolves day, week, and month jumps.
12. It verifies month day and year selection ranges move cleanly across separators.
13. It verifies date shortcuts use the current day while preserving datetime-local time.
14. It verifies date selection merges with an existing or fallback time for datetime-local values.
*/

import { describe, expect, it } from 'vitest';

import {
	buildCalendarMonthWindow,
	buildCalendarGrid,
	buildShortcutValue,
	clampPickerValue,
	consumeCalendarWheelDelta,
	formatPickerValueForDisplay,
	inferPickerYearRange,
	mergeDateKeyWithValue,
	moveDisplaySelectionRange,
	parseDisplayPickerValue,
	parsePickerValue,
	resolveCalendarKeyboardDateKey,
	resolveCalendarMonthStripTranslatePercent,
	resolveDisplaySelectionRange,
	resolvePickerYearRange,
	serializePickerValue,
	shouldResetCalendarWheelGesture,
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

	it('formats date values for display using month/day/year by default', () => {
		expect(formatPickerValueForDisplay('2026-04-08', 'date')).toBe('04/08/2026');
		expect(formatPickerValueForDisplay('2026-04-08T14:35', 'datetime-local')).toBe(
			'04/08/2026 14:35'
		);
	});

	it('supports custom display formats when one is provided', () => {
		expect(formatPickerValueForDisplay('2026-04-08', 'date', 'DD.MM.YYYY')).toBe('08.04.2026');
		expect(parseDisplayPickerValue('08.04.2026', 'date', 'DD.MM.YYYY')).toBe('2026-04-08');
	});

	it('rejects invalid values instead of coercing them', () => {
		expect(parsePickerValue('2026-02-30', 'date')).toBeNull();
		expect(parsePickerValue('2026-04-08T25:10', 'datetime-local')).toBeNull();
	});

	it('parses default month/day/year display input back to ISO values', () => {
		expect(parseDisplayPickerValue('04/08/2026', 'date')).toBe('2026-04-08');
		expect(parseDisplayPickerValue('04/08/2026 14:35', 'datetime-local')).toBe(
			'2026-04-08T14:35'
		);
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

	it('builds an ordered previous current and next month strip for calendar snapping', () => {
		expect(buildCalendarMonthWindow({ year: 2026, month: 4 }, 'date')).toEqual([
			{ year: 2026, month: 3 },
			{ year: 2026, month: 4 },
			{ year: 2026, month: 5 }
		]);

		expect(buildCalendarMonthWindow({ year: 2026, month: 3 }, 'date', '2026-03-10', '2026-08-22')).toEqual([
			{ year: 2026, month: 3 },
			{ year: 2026, month: 3 },
			{ year: 2026, month: 4 }
		]);
	});

	it('resolves month strip offsets by single month pages instead of the whole strip height', () => {
		expect(resolveCalendarMonthStripTranslatePercent(0)).toBeCloseTo(-100 / 3, 6);
		expect(resolveCalendarMonthStripTranslatePercent(1)).toBeCloseTo(-200 / 3, 6);
		expect(resolveCalendarMonthStripTranslatePercent(-1)).toBe(0);
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

	it('defaults year ranges to the current year and ten years into the future', () => {
		expect(resolvePickerYearRange(undefined, undefined, new Date(2026, 3, 8))).toEqual({
			minYear: 2026,
			maxYear: 2036
		});
	});

	it('infers year ranges from contextual values while respecting caller intent', () => {
		expect(
			inferPickerYearRange(
				['2024-09-01', '2025-02-15T18:00'],
				{ futureYears: 3, pastYears: 0, now: new Date(2026, 3, 8) }
			)
		).toEqual({
			minYear: 2024,
			maxYear: 2029
		});

		expect(
			inferPickerYearRange([], {
				minYear: 2028,
				maxYear: 2026,
				now: new Date(2026, 3, 8)
			})
		).toEqual({
			minYear: 2026,
			maxYear: 2028
		});

		expect(
			inferPickerYearRange([2031], {
				minYear: 2026,
				maxYear: 2028,
				now: new Date(2026, 3, 8)
			})
		).toEqual({
			minYear: 2026,
			maxYear: 2031
		});
	});

	it('accumulates wheel scrolling into a single previous or next month shift per gesture', () => {
		expect(consumeCalendarWheelDelta(0, 24)).toEqual({
			remainderDeltaY: 24,
			monthDelta: 0
		});
		expect(consumeCalendarWheelDelta(24, 52)).toEqual({
			remainderDeltaY: 0,
			monthDelta: 1
		});
		expect(consumeCalendarWheelDelta(0, -170)).toEqual({
			remainderDeltaY: 0,
			monthDelta: -1
		});
	});

	it('resets wheel gestures after a pause or direction change', () => {
		expect(shouldResetCalendarWheelGesture(null, 1000, 0, 28)).toBe(true);
		expect(shouldResetCalendarWheelGesture(1000, 1020, 1, 28)).toBe(false);
		expect(shouldResetCalendarWheelGesture(1000, 1038, 1, 28)).toBe(true);
		expect(shouldResetCalendarWheelGesture(1000, 1035, 1, -14)).toBe(true);
	});

	it('resolves keyboard calendar movement across day week and month jumps', () => {
		expect(resolveCalendarKeyboardDateKey('2026-06-04', 'ArrowLeft', false)).toBe('2026-06-03');
		expect(resolveCalendarKeyboardDateKey('2026-06-04', 'ArrowRight', false)).toBe('2026-06-05');
		expect(resolveCalendarKeyboardDateKey('2026-06-04', 'ArrowUp', false)).toBe('2026-05-28');
		expect(resolveCalendarKeyboardDateKey('2026-06-04', 'ArrowDown', false)).toBe('2026-06-11');
		expect(resolveCalendarKeyboardDateKey('2026-06-04', 'ArrowUp', true)).toBe('2026-05-04');
		expect(resolveCalendarKeyboardDateKey('2026-03-31', 'ArrowDown', true)).toBe(
			'2026-04-30'
		);
		expect(resolveCalendarKeyboardDateKey('2026-06-04', 'Enter', false)).toBeNull();
	});

	it('moves month day and year selection ranges across formatted date separators', () => {
		expect(resolveDisplaySelectionRange('04/09/2026', 'date', undefined, 0)).toEqual({
			start: 0,
			end: 2
		});
		expect(resolveDisplaySelectionRange('04/09/2026', 'date', undefined, 3)).toEqual({
			start: 3,
			end: 5
		});
		expect(resolveDisplaySelectionRange('04/09/2026', 'date', undefined, 6)).toEqual({
			start: 6,
			end: 10
		});
		expect(moveDisplaySelectionRange('04/09/2026', 'date', undefined, 0, 2, 1)).toEqual({
			start: 3,
			end: 5
		});
		expect(moveDisplaySelectionRange('04/09/2026', 'date', undefined, 3, 5, 1)).toEqual({
			start: 6,
			end: 10
		});
		expect(moveDisplaySelectionRange('04/09/2026', 'date', undefined, 6, 10, -1)).toEqual({
			start: 3,
			end: 5
		});
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
