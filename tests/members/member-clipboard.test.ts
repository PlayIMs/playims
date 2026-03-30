/*
Brief description:
This file verifies the helper that formats member table rows for clipboard copying.

Deeper explanation:
The members table now exposes a row-level copy action that should copy the same data someone sees in
the table, but in a tab-separated format that pastes cleanly into spreadsheets or messages. These
tests protect the formatting rules so phone numbers, login timestamps, fallbacks, and role labels do
not drift quietly over time.

Summary of tests:
1. It verifies that member rows are copied as tab-separated display values in table order.
2. It verifies that missing optional values fall back to the same placeholders shown in the table.
*/

import { describe, expect, it } from 'vitest';
import {
	formatMemberLastLoginForDisplay,
	formatMemberRowForClipboard
} from '../../src/lib/members/clipboard';
import type { MemberListRow } from '../../src/lib/members/types';

const buildRow = (overrides: Partial<MemberListRow> = {}): MemberListRow => ({
	membershipId: 'membership-1',
	userId: 'user-1',
	studentId: '12345',
	firstName: 'Jamie',
	lastName: 'Member',
	fullName: 'Jamie Member',
	email: 'jamie@playims.test',
	cellPhone: '+16618033757',
	lastLoginAt: '2029-12-21T14:30:00.000Z',
	sex: 'F',
	role: 'manager',
	status: 'active',
	createdAt: '2029-12-20T00:00:00.000Z',
	updatedAt: '2029-12-20T00:00:00.000Z',
	...overrides
});

describe('member clipboard helpers', () => {
	it('formats member rows as tab-separated display values', () => {
		// spreadsheet-friendly row copying depends on the exact column order staying aligned with the table.
		const row = buildRow();

		expect(formatMemberRowForClipboard(row)).toBe(
			[
				'Jamie Member',
				'12345',
				'jamie@playims.test',
				'(661) 803-3757',
				formatMemberLastLoginForDisplay('2029-12-21T14:30:00.000Z'),
				'F',
				'Manager'
			].join('\t')
		);
	});

	it('uses the same placeholder fallbacks shown in the table for missing values', () => {
		// keeping placeholders aligned prevents copied rows from looking emptier or more confusing than the UI.
		const row = buildRow({
			studentId: null,
			email: null,
			cellPhone: null,
			lastLoginAt: null,
			sex: null,
			role: 'participant'
		});

		expect(formatMemberRowForClipboard(row)).toBe(
			['Jamie Member', '--', '--', '--', 'Never', '--', 'Participant'].join('\t')
		);
	});
});
