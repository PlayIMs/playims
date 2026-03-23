import type {
	DataTableColumn,
	DataTableSortDirection,
	DataTableSortState
} from './data-table.js';

type SortableValue = string | number | null | undefined;

function compareSortableValues(a: SortableValue, b: SortableValue): number {
	const aMissing = a === null || a === undefined || a === '';
	const bMissing = b === null || b === undefined || b === '';
	if (aMissing && bMissing) return 0;
	if (aMissing) return 1;
	if (bMissing) return -1;

	if (typeof a === 'number' && typeof b === 'number') {
		return a - b;
	}

	return String(a).localeCompare(String(b), undefined, {
		numeric: true,
		sensitivity: 'base'
	});
}

function compareWithDirection(compareResult: number, direction: DataTableSortDirection): number {
	return direction === 'desc' ? compareResult * -1 : compareResult;
}

export function areDataTableSortStatesEqual(
	a: DataTableSortState | null | undefined,
	b: DataTableSortState | null | undefined
): boolean {
	if (!a && !b) return true;
	if (!a || !b) return false;
	return a.columnKey === b.columnKey && a.direction === b.direction;
}

export function getActiveDataTableSortState(
	sortOverride: DataTableSortState | null | undefined,
	defaultSort: DataTableSortState | null | undefined
): DataTableSortState | null {
	return sortOverride ?? defaultSort ?? null;
}

export function isDataTableColumnSortable<TRow>(column: DataTableColumn<TRow>): boolean {
	return Boolean(column.sortComparator || column.sortValue);
}

export function getNextDataTableSortOverride(
	columnKey: string,
	currentSortOverride: DataTableSortState | null | undefined,
	defaultSort: DataTableSortState | null | undefined
): DataTableSortState | null {
	const ascState: DataTableSortState = { columnKey, direction: 'asc' };
	const descState: DataTableSortState = { columnKey, direction: 'desc' };
	const defaultMatchesColumn = defaultSort?.columnKey === columnKey;

	if (currentSortOverride?.columnKey !== columnKey) {
		if (!defaultMatchesColumn) return ascState;
		return defaultSort?.direction === 'asc' ? descState : ascState;
	}

	if (!defaultMatchesColumn) {
		return currentSortOverride.direction === 'asc' ? descState : null;
	}

	if (currentSortOverride.direction !== defaultSort?.direction) {
		return { columnKey, direction: defaultSort?.direction ?? 'asc' };
	}

	return null;
}

export function sortDataTableRows<TRow>(
	rows: readonly TRow[],
	columns: readonly DataTableColumn<TRow>[],
	sortState: DataTableSortState | null | undefined
): TRow[] {
	if (!sortState) return [...rows];

	const targetColumn = columns.find((column) => column.key === sortState.columnKey);
	if (!targetColumn || !isDataTableColumnSortable(targetColumn)) return [...rows];

	return [...rows]
		.map((row, index) => ({ row, index }))
		.sort((a, b) => {
			const baseComparison = targetColumn.sortComparator
				? targetColumn.sortComparator(a.row, b.row)
				: compareSortableValues(targetColumn.sortValue?.(a.row), targetColumn.sortValue?.(b.row));
			const directionalComparison = compareWithDirection(baseComparison, sortState.direction);
			if (directionalComparison !== 0) return directionalComparison;
			return a.index - b.index;
		})
		.map(({ row }) => row);
}
