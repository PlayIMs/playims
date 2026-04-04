/*
Brief description:
This file verifies the shared academic-season helper used by the season creation wizards.

Deeper explanation:
The season wizards now infer placeholders and default academic-year dates from season names such
as `2026-27`. These tests protect the pure date rules in one place so both the offerings and club
season flows stay aligned without relying on brittle UI-only coverage.

Summary of tests:
1. It verifies that the current academic-season placeholder uses a four-digit year and two-digit next year.
2. It verifies that academic-season names infer the expected August and May default dates.
3. It verifies that start-date changes still resolve an academic-year end date when no season name pattern exists.
*/

import { describe, expect, it } from 'vitest';

import {
	buildAcademicSeasonLabel,
	getAcademicSeasonRange,
	getCurrentAcademicSeasonLabel,
	inferAcademicSeasonRangeFromName,
	resolveAcademicSeasonEndDate
} from '../../src/lib/utils/academic-season';

describe('academic season helpers', () => {
	it('builds the current academic-season placeholder with a short second year', () => {
		// the wizard placeholder should follow the 2026-27 style rather than repeating four digits.
		expect(buildAcademicSeasonLabel(2026)).toBe('2026-27');
		expect(getCurrentAcademicSeasonLabel(new Date('2027-04-03T12:00:00-05:00'))).toBe('2027-28');
	});

	it('infers the default academic-year range from season names', () => {
		// the third sunday of august and first sunday of may are the shared defaults the user requested.
		expect(getAcademicSeasonRange(2026)).toEqual({
			label: '2026-27',
			startYear: 2026,
			startDate: '2026-08-16',
			endDate: '2027-05-02'
		});
		expect(inferAcademicSeasonRangeFromName('2026-27')).toEqual({
			label: '2026-27',
			startYear: 2026,
			startDate: '2026-08-16',
			endDate: '2027-05-02'
		});
		expect(inferAcademicSeasonRangeFromName('Academic Year 2026-2027')).toEqual({
			label: '2026-27',
			startYear: 2026,
			startDate: '2026-08-16',
			endDate: '2027-05-02'
		});
	});

	it('resolves the end date from the season name first and from the chosen start date otherwise', () => {
		// a parsed academic-year name should keep the same may end date even if the start date shifts.
		expect(resolveAcademicSeasonEndDate('2026-27', '2026-09-03')).toBe('2027-05-02');

		// when no academic-year name is present, the helper should still choose the next sensible may endpoint.
		expect(resolveAcademicSeasonEndDate('', '2026-04-01')).toBe('2026-05-03');
		expect(resolveAcademicSeasonEndDate('', '2026-09-03')).toBe('2027-05-02');
	});
});
