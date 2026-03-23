export type DataTableTextAlignment = 'left' | 'center' | 'right';
export type DataTableVerticalAlignment = 'top' | 'middle' | 'bottom';
export type DataTableHorizontalPadding = 'default' | 'none';
export type DataTableHeaderTextTransform = 'uppercase' | 'normal';

export interface DataTableColumn {
	key: string;
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
}
