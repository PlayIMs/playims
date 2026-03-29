export type DataTableTextAlignment = 'left' | 'center' | 'right';
export type DataTableVerticalAlignment = 'top' | 'middle' | 'bottom';
export type DataTableHorizontalPadding = 'default' | 'none';
export type DataTableHeaderTextTransform = 'title' | 'uppercase' | 'normal';
export type DataTableSortDirection = 'asc' | 'desc';
export type DataTableRowActionMode = 'none' | 'single' | 'menu';

export interface DataTableSortState {
	columnKey: string;
	direction: DataTableSortDirection;
}

export interface DataTableColumn<TRow = unknown> {
	key: string;
	/**
	 * Use title case for user-facing column header labels.
	 */
	label: string;
	/**
	 * Recommended header hover tooltip copy shown when the user hovers the column title.
	 */
	headerHoverTooltipText?: string;
	/**
	 * Legacy alias for header hover tooltip copy. Prefer `headerHoverTooltipText`.
	 */
	headerTooltipText?: string;
	width?: string;
	headerTextAlignment?: DataTableTextAlignment;
	cellTextAlignment?: DataTableTextAlignment;
	cellVerticalAlignment?: DataTableVerticalAlignment;
	headerPaddingX?: DataTableHorizontalPadding;
	headerPaddingLeft?: string;
	headerPaddingRight?: string;
	cellPaddingX?: DataTableHorizontalPadding;
	cellPaddingLeft?: string;
	cellPaddingRight?: string;
	headerTextTransform?: DataTableHeaderTextTransform;
	tabularNumbers?: boolean;
	rowHeader?: boolean;
	sortValue?: (row: TRow) => string | number | null | undefined;
	sortComparator?: (a: TRow, b: TRow) => number;
}

export interface DataTableRowActionOption {
	value: string;
	label: string;
	description?: string;
	statusLabel?: string;
	rightLabel?: string;
	rightDescription?: string;
	searchText?: string;
	disabled?: boolean;
	separatorBefore?: boolean;
	tooltip?: string;
	disabledTooltip?: string;
}

export const DATA_TABLE_ROW_ACTION_COLUMN_KEY = 'manage';

export function createDataTableRowActionColumn<TRow = unknown>(
	overrides: Partial<DataTableColumn<TRow>> = {}
): DataTableColumn<TRow> {
	return {
		key: DATA_TABLE_ROW_ACTION_COLUMN_KEY,
		label: '',
		width: '2.75rem',
		headerPaddingX: 'none',
		cellPaddingX: 'none',
		cellPaddingLeft: '0.125rem',
		cellPaddingRight: '0.125rem',
		headerTextAlignment: 'right',
		cellTextAlignment: 'right',
		cellVerticalAlignment: 'middle',
		headerTextTransform: 'normal',
		...overrides
	};
}

export function getDataTableRowActionMode(
	options: DataTableRowActionOption[]
): DataTableRowActionMode {
	if (options.length === 0) return 'none';
	if (options.length === 1) return 'single';
	return 'menu';
}

export function getSingleDataTableRowActionOption(
	options: DataTableRowActionOption[]
): DataTableRowActionOption | null {
	return getDataTableRowActionMode(options) === 'single' ? (options[0] ?? null) : null;
}
