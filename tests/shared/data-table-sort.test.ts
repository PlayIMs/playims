/*
Brief description:
This file verifies the shared DataTable sorting helpers for default-order restoration and stable row sorting.

Deeper explanation:
The shared DataTable now needs to support two ideas at the same time: a page-defined default order and
temporary user-selected column sorting. These tests protect the helper rules that decide which sort state
is active after header clicks and how rows are ordered once a sort is applied, including the requirement
that ties keep their original incoming order.

Summary of tests:
1. It verifies that the custom incoming row order stays unchanged when no sort is active.
2. It verifies that a default-sorted column still cycles through the opposite direction, the matching explicit direction, then back to default.
3. It verifies that a different sortable column starts in ascending order.
4. It verifies that a custom-order table cycles through ascending, descending, then back to default.
5. It verifies that equal sort values keep their original row order.
6. It verifies that a column can reuse the shared division day/time comparator.
*/

import { describe, expect, it } from 'vitest';

import type { DataTableColumn, DataTableSortState } from '../../src/lib/components/data-table';
import {
	getActiveDataTableSortState,
	getNextDataTableSortOverride,
	sortDataTableRows
} from '../../src/lib/components/data-table-sort';
import { compareByDayOfWeekAndTime } from '../../src/lib/utils/schedule-sort';

interface NamedRow {
	name: string;
	joinedAt: number;
	group: string;
	dayOfWeek?: string | null;
	gameTime?: string | null;
}

function sortState(columnKey: string, direction: DataTableSortState['direction']): DataTableSortState {
	return { columnKey, direction };
}

describe('data table sort helpers', () => {
	it('keeps the incoming custom order when no sort is active', () => {
		const rows: NamedRow[] = [
			{ name: 'Third', joinedAt: 3, group: 'b' },
			{ name: 'First', joinedAt: 1, group: 'a' },
			{ name: 'Second', joinedAt: 2, group: 'a' }
		];
		const columns: DataTableColumn<NamedRow>[] = [
			{ key: 'team', label: 'Team', sortValue: (row) => row.name }
		];

		// no active sort means the page's incoming order must be preserved exactly.
		expect(sortDataTableRows(rows, columns, null).map((row) => row.name)).toEqual([
			'Third',
			'First',
			'Second'
		]);
	});

	it('cycles a default ascending column through descending, explicit ascending, then default', () => {
		const defaultSort = sortState('date-joined', 'asc');

		// a default sort and an explicit user-chosen sort can share the same direction
		// while still being different UI states, so the cycle must keep all three steps.
		expect(getNextDataTableSortOverride('date-joined', null, defaultSort)).toEqual(
			sortState('date-joined', 'desc')
		);
		expect(
			getNextDataTableSortOverride('date-joined', sortState('date-joined', 'desc'), defaultSort)
		).toEqual(sortState('date-joined', 'asc'));
		expect(
			getNextDataTableSortOverride('date-joined', sortState('date-joined', 'asc'), defaultSort)
		).toBeNull();
		expect(getActiveDataTableSortState(null, defaultSort)).toEqual(defaultSort);
	});

	it('starts a different sortable column in ascending order', () => {
		const defaultSort = sortState('date-joined', 'asc');

		// switching columns should always begin in ascending order for that new column.
		expect(getNextDataTableSortOverride('team', null, defaultSort)).toEqual(sortState('team', 'asc'));
	});

	it('cycles a custom-order table through ascending, descending, then default', () => {
		// a table with no default sort should use null as the restore state.
		expect(getNextDataTableSortOverride('team', null, null)).toEqual(sortState('team', 'asc'));
		expect(getNextDataTableSortOverride('team', sortState('team', 'asc'), null)).toEqual(
			sortState('team', 'desc')
		);
		expect(getNextDataTableSortOverride('team', sortState('team', 'desc'), null)).toBeNull();
	});

	it('keeps the original row order when sort values tie', () => {
		const rows: NamedRow[] = [
			{ name: 'Alpha', joinedAt: 1, group: 'same' },
			{ name: 'Bravo', joinedAt: 2, group: 'same' },
			{ name: 'Charlie', joinedAt: 3, group: 'same' }
		];
		const columns: DataTableColumn<NamedRow>[] = [
			{ key: 'group', label: 'Group', sortValue: (row) => row.group }
		];

		// stable sorting prevents equal values from jumping around unexpectedly between renders.
		expect(sortDataTableRows(rows, columns, sortState('group', 'asc')).map((row) => row.name)).toEqual(
			['Alpha', 'Bravo', 'Charlie']
		);
	});

	it('reuses the shared day and time comparator for division schedule sorting', () => {
		const rows: NamedRow[] = [
			{ name: 'Friday Late', joinedAt: 3, group: 'b', dayOfWeek: 'Friday', gameTime: '8:00 PM' },
			{
				name: 'Monday Range',
				joinedAt: 2,
				group: 'a',
				dayOfWeek: 'Monday-Friday',
				gameTime: '6:00 PM - 8:00 PM'
			},
			{ name: 'Monday Early', joinedAt: 1, group: 'a', dayOfWeek: 'Monday', gameTime: '5:00 PM' }
		];
		const columns: DataTableColumn<NamedRow>[] = [
			{
				key: 'division',
				label: 'Division',
				sortComparator: compareByDayOfWeekAndTime
			}
		];

		// this locks the promise that DataTable will reuse the existing division schedule helper.
		expect(sortDataTableRows(rows, columns, sortState('division', 'asc')).map((row) => row.name)).toEqual(
			['Monday Early', 'Monday Range', 'Friday Late']
		);
	});
});
