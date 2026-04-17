/*
Brief description:
This file verifies the shared phone-format helper used by account and members surfaces.

Deeper explanation:
Phone numbers were starting to drift between screens, with some places showing only the national
portion and others exposing raw stored values. These tests protect one shared formatter so the app
shows common US numbers without a visible +1 while preserving non-default country codes.

Summary of tests:
1. It verifies that raw ten-digit numbers default to the common US display format without showing +1.
2. It verifies that stored international-style numbers keep their non-default country code in the display text.
3. It verifies that the national formatter produces the expected masked layout from raw digits.
4. It verifies that search normalization strips punctuation and treats a leading +1 as optional.
5. It verifies that storage normalization preserves the country code and strips punctuation.
*/

import { describe, expect, it } from 'vitest';
import {
	formatPhoneForDisplay,
	formatPhoneNationalFromDigits,
	normalizePhoneForStorage,
	normalizePhoneDigitsForSearch,
	parseStoredPhoneNumber
} from '../../src/lib/utils/phone-format';

describe('phone format helpers', () => {
	it('defaults raw ten-digit numbers to the common US display format without showing plus one', () => {
		// legacy values without an explicit country code should still render in the shared app format.
		expect(formatPhoneForDisplay('5551234567')).toBe('(555) 123-4567');
	});

	it('preserves the stored country code when formatting a saved number', () => {
		// saved phone numbers should not lose non-default country prefixes when they are displayed back to the user.
		expect(parseStoredPhoneNumber('+445551234567').countryCode).toBe('+44');
		expect(formatPhoneForDisplay('+15551234567')).toBe('(555) 123-4567');
		expect(formatPhoneForDisplay('+445551234567')).toBe('+44 (555) 123-4567');
	});

	it('formats national digits with the expected masked layout', () => {
		// the shared mask keeps every surface aligned without each page reinventing its own phone pattern.
		expect(formatPhoneNationalFromDigits('5551234567')).toBe('(555) 123-4567');
	});

	it('normalizes phone search input by stripping punctuation and an optional leading one', () => {
		// member search should treat formatted input and raw digits as the same phone number query.
		expect(normalizePhoneDigitsForSearch('+1 (555) 123-4567')).toBe('5551234567');
		expect(normalizePhoneDigitsForSearch('555.123.4567')).toBe('5551234567');
		expect(normalizePhoneDigitsForSearch('(555) 123-4567')).toBe('5551234567');
	});

	it('normalizes stored phone values into a canonical country code plus digits format', () => {
		// member editing should save one clean phone string even when the user typed punctuation.
		expect(normalizePhoneForStorage('+1 (555) 123-4567')).toBe('+15551234567');
		expect(normalizePhoneForStorage('555.123.4567')).toBe('+15551234567');
		expect(normalizePhoneForStorage('')).toBeNull();
	});
});
