/*
Brief description:
This file verifies the shared phone-format helper used by account and members surfaces.

Deeper explanation:
Phone numbers were starting to drift between screens, with some places showing only the national
portion and others exposing raw stored values. These tests protect one shared formatter so the app
shows phone numbers consistently as a country code plus a formatted ten-digit national number.

Summary of tests:
1. It verifies that raw ten-digit numbers default to the +1 display format.
2. It verifies that stored international-style numbers keep their country code in the display text.
3. It verifies that the national formatter produces the expected masked layout from raw digits.
*/

import { describe, expect, it } from 'vitest';
import {
	formatPhoneForDisplay,
	formatPhoneNationalFromDigits,
	parseStoredPhoneNumber
} from '../../src/lib/utils/phone-format';

describe('phone format helpers', () => {
	it('defaults raw ten-digit numbers to the +1 display format', () => {
		// legacy values without an explicit country code should still render in the shared app format.
		expect(formatPhoneForDisplay('5551234567')).toBe('+1 (555) 123-4567');
	});

	it('preserves the stored country code when formatting a saved number', () => {
		// saved phone numbers should not lose their country prefix when they are displayed back to the user.
		expect(parseStoredPhoneNumber('+445551234567').countryCode).toBe('+44');
		expect(formatPhoneForDisplay('+15551234567')).toBe('+1 (555) 123-4567');
	});

	it('formats national digits with the expected masked layout', () => {
		// the shared mask keeps every surface aligned without each page reinventing its own phone pattern.
		expect(formatPhoneNationalFromDigits('5551234567')).toBe('(555) 123-4567');
	});
});
