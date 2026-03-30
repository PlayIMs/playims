/*
Brief description:
This file verifies the shared DataTable clipboard helpers for opt-in copy columns.

Deeper explanation:
The shared DataTable now supports a reusable click-to-copy behavior, but only when a column explicitly
opts into it. These tests protect that contract so existing tables stay unchanged by default, blank
values do not produce awkward clipboard interactions, and the shared success message stays consistent
wherever the feature is enabled in the future.

Summary of tests:
1. It verifies that columns are not copy-enabled unless they explicitly provide a copyText resolver.
2. It verifies that copy text is trimmed and blank values are treated as unavailable.
3. It verifies that the shared clipboard toast message uses the expected copy wording.
*/

import { describe, expect, it } from 'vitest';

import {
	formatDataTableClipboardSuccessMessage,
	getDataTableColumnCopyText,
	isDataTableColumnCopyEnabled,
	type DataTableColumn
} from '../../src/lib/components/data-table';

type MemberRow = {
	email: string | null;
	studentId: string | null;
};

describe('data table clipboard helpers', () => {
	it('keeps clipboard behavior disabled unless a column opts in', () => {
		const defaultColumn: DataTableColumn<MemberRow> = {
			key: 'email',
			label: 'Email'
		};
		const copyColumn: DataTableColumn<MemberRow> = {
			key: 'studentId',
			label: 'Student ID',
			copyText: (row) => row.studentId
		};

		// existing tables should not change unless they deliberately add the new resolver.
		expect(isDataTableColumnCopyEnabled(defaultColumn)).toBe(false);
		expect(isDataTableColumnCopyEnabled(copyColumn)).toBe(true);
	});

	it('trims available copy text and treats blank values as unavailable', () => {
		const column: DataTableColumn<MemberRow> = {
			key: 'email',
			label: 'Email',
			copyText: (row) => row.email
		};

		// this keeps placeholder or whitespace-only values from showing a copy affordance that cannot help.
		expect(getDataTableColumnCopyText(column, { email: '  student@example.edu  ', studentId: null })).toBe(
			'student@example.edu'
		);
		expect(getDataTableColumnCopyText(column, { email: '   ', studentId: null })).toBeNull();
		expect(getDataTableColumnCopyText(column, { email: null, studentId: null })).toBeNull();
	});

	it('formats the shared clipboard success message with the copied text', () => {
		// one message helper keeps future copy-enabled tables aligned on the same confirmation copy.
		expect(formatDataTableClipboardSuccessMessage('abc123')).toBe('Copied "abc123" to clipboard.');
	});
});
