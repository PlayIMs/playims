/*
Brief description:
This file verifies the state text shown beside shared toggle switches.

Deeper explanation:
The field label describes the setting, while the value text describes its current state.
Season status honors the explicit current flag before comparing local calendar dates.

Summary of tests:
1. It verifies checked and unchecked state labels and custom overrides.
2. It verifies current, past, future, and missing-date season states.
*/
import { describe, expect, it } from 'vitest';
import { getToggleStatus, getSeasonToggleStatus } from '../../src/lib/utils/toggle-status';

describe('toggle state text', () => {
	it('uses readable defaults and caller-supplied labels', () => {
		expect(getToggleStatus(true)).toBe('Enabled');
		expect(getToggleStatus(false)).toBe('Disabled');
		expect(getToggleStatus(false, 'Active', 'Inactive')).toBe('Inactive');
	});
	it('honors current status and otherwise compares the start date locally', () => {
		// midday local time keeps the test independent of utc date boundaries.
		const today = new Date(2026, 9, 5, 12);
		expect(getSeasonToggleStatus(true, '2027-01-01', today)).toBe('Current');
		expect(getSeasonToggleStatus(false, '2027-01-01', today)).toBe('Future');
		expect(getSeasonToggleStatus(false, '2026-10-05', today)).toBe('Past');
		expect(getSeasonToggleStatus(false, '2026-08-01', today)).toBe('Past');
		expect(getSeasonToggleStatus(false, '', today)).toBe('Not Current');
		expect(getSeasonToggleStatus(false, 'invalid', today)).toBe('Not Current');
	});
});
