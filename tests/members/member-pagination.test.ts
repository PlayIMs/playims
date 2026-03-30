/*
Brief description:
This file verifies the members pagination helpers that power the editable page input.

Deeper explanation:
The members table now lets someone type a page number directly instead of only clicking next and previous.
These tests protect the parsing and clamping rules so out-of-range or invalid values always snap back to the
nearest real page instead of leaving the UI in a broken or confusing state.

Summary of tests:
1. It verifies that valid requested page numbers are preserved.
2. It verifies that requested page numbers are clamped to the available range.
3. It verifies that blank input falls back to the current page.
4. It verifies that non-numeric input falls back to the current page.
5. It verifies that non-positive numeric input snaps to the first available page.
6. It verifies that decimal input is truncated before clamping.
*/

import { describe, expect, it } from 'vitest';
import { parseMemberPageInput, resolveClosestMemberPage } from '../../src/lib/members/pagination';

describe('member pagination helpers', () => {
	it('preserves valid page numbers that exist', () => {
		// valid page jumps should not be changed behind the user's back.
		expect(resolveClosestMemberPage(4, 8)).toBe(4);
	});

	it('clamps page numbers to the nearest available page', () => {
		// oversized or undersized values should land on the closest real page instead of failing.
		expect(resolveClosestMemberPage(0, 6)).toBe(1);
		expect(resolveClosestMemberPage(99, 6)).toBe(6);
	});

	it('falls back to the current page when the input is blank', () => {
		// erasing the field and leaving it should restore the current page value cleanly.
		expect(parseMemberPageInput('', 3, 8)).toBe(3);
	});

	it('falls back to the current page when the input is not a number', () => {
		// invalid text should never push the table into a bad pagination state.
		expect(parseMemberPageInput('abc', 3, 8)).toBe(3);
	});

	it('snaps non-positive numeric input to the first available page', () => {
		// page zero or negative page numbers do not exist, so the helper should send them to page one.
		expect(parseMemberPageInput('0', 3, 8)).toBe(1);
		expect(parseMemberPageInput('-4', 3, 8)).toBe(1);
	});

	it('truncates decimals before clamping them into range', () => {
		// typing a decimal should behave predictably instead of producing a fractional page.
		expect(parseMemberPageInput('4.9', 1, 8)).toBe(4);
	});
});
