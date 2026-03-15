/*
Brief description:
This file verifies the division-name schedule inference used by the division wizard.

Deeper explanation:
Division names can encode schedule details in many shorthand formats. If the parser misses multi-day
patterns, range patterns, or chained times, the wizard can silently fill the wrong fields. These tests
protect the shared inference utility directly so UI refactors do not break the parsing contract.

Summary of tests:
1. It verifies that comma-separated, slash-separated, and abbreviated day patterns normalize correctly.
2. It verifies that weekday ranges and sorted selections format into stable canonical strings.
3. It verifies that inferred time ranges preserve dash semantics while slash stays discrete.
4. It verifies that inferred times normalize correctly and carry a shared meridiem when needed.
*/

import { describe, expect, it } from 'vitest';
import {
	formatDivisionDays,
	formatDivisionTimes,
	inferDivisionNameDetails,
	inferGameTimeFromDivisionName,
	parseDivisionDays,
	parseDivisionTimeSegments
} from '../../src/lib/utils/division-schedule-inference';

describe('division schedule inference', () => {
	it('parses multiple days from comma, slash, and abbreviation patterns', () => {
		expect(parseDivisionDays('Monday, Wednesday, Tuesday 5:00 PM / 7')).toEqual([
			'Monday',
			'Wednesday',
			'Tuesday'
		]);
		expect(parseDivisionDays('Monday/Wednesday 7:00 PM')).toEqual(['Monday', 'Wednesday']);
		expect(parseDivisionDays('Monday /Tuesday')).toEqual(['Monday', 'Tuesday']);
		expect(parseDivisionDays('5:00 PM Monday & Tuesday')).toEqual(['Monday', 'Tuesday']);
		expect(parseDivisionDays('M/W/F - 2 PM')).toEqual(['Monday', 'Wednesday', 'Friday']);
	});

	it('formats sorted weekday selections into compact canonical strings', () => {
		expect(formatDivisionDays(['Monday', 'Wednesday', 'Tuesday'])).toBe('Monday-Wednesday');
		expect(formatDivisionDays(['Monday', 'Wednesday', 'Friday'])).toBe(
			'Monday / Wednesday / Friday'
		);
		expect(inferDivisionNameDetails('Mon Tue Wed')).toEqual({
			dayOfWeek: 'Monday-Wednesday',
			gameTime: ''
		});
		expect(inferDivisionNameDetails('Monday-Friday 5:00 PM')).toEqual({
			dayOfWeek: 'Monday-Friday',
			gameTime: '5:00 PM'
		});
	});

	it('normalizes multiple inferred times and carries forward a shared meridiem', () => {
		expect(inferGameTimeFromDivisionName('Tuesday 5:30/6:15PM')).toBe('5:30 PM / 6:15 PM');
		expect(inferGameTimeFromDivisionName('Monday, Wednesday, Tuesday 5:00 PM / 7')).toBe(
			'5:00 PM / 7:00 PM'
		);
		expect(inferGameTimeFromDivisionName('Tuesday 6P-8P')).toBe('6:00 PM - 8:00 PM');
		expect(inferGameTimeFromDivisionName('Wednesday 9A/10A')).toBe('9:00 AM / 10:00 AM');
		expect(inferGameTimeFromDivisionName('Monday-Friday 6pm-8pm')).toBe('6:00 PM - 8:00 PM');
		expect(inferGameTimeFromDivisionName('Tuesday 6-8 PM')).toBe('6:00 PM - 8:00 PM');
		expect(inferDivisionNameDetails('Monday-Friday|6pm-8pm')).toEqual({
			dayOfWeek: 'Monday-Friday',
			gameTime: '6:00 PM - 8:00 PM'
		});
		expect(inferDivisionNameDetails('Monday /Tuesday')).toEqual({
			dayOfWeek: 'Monday / Tuesday',
			gameTime: ''
		});
		expect(inferDivisionNameDetails('5:00 PM Monday & Tuesday')).toEqual({
			dayOfWeek: 'Monday / Tuesday',
			gameTime: '5:00 PM'
		});
		expect(inferDivisionNameDetails('M/W/F - 2 PM')).toEqual({
			dayOfWeek: 'Monday / Wednesday / Friday',
			gameTime: '2:00 PM'
		});
	});

	it('preserves range versus discrete time separators in canonical display output', () => {
		expect(parseDivisionTimeSegments('6pm-8pm')).toEqual([
			{
				kind: 'range',
				values: ['6:00 PM', '8:00 PM']
			}
		]);
		expect(parseDivisionTimeSegments('6P-8P')).toEqual([
			{
				kind: 'range',
				values: ['6:00 PM', '8:00 PM']
			}
		]);
		expect(parseDivisionTimeSegments('9A/10A')).toEqual([
			{
				kind: 'list',
				values: ['9:00 AM', '10:00 AM']
			}
		]);
		expect(parseDivisionTimeSegments('5:30/6:15PM')).toEqual([
			{
				kind: 'list',
				values: ['5:30 PM', '6:15 PM']
			}
		]);
		expect(formatDivisionTimes(parseDivisionTimeSegments('Monday-Friday 6pm-8pm'))).toBe(
			'6:00 PM - 8:00 PM'
		);
		expect(formatDivisionTimes(parseDivisionTimeSegments('Tuesday 5:30/6:15PM'))).toBe(
			'5:30 PM / 6:15 PM'
		);
	});
});
