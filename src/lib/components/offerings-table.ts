export type OfferingsTableTextAlignment = 'left' | 'center' | 'right';
export type OfferingsTableVerticalAlignment = 'top' | 'middle' | 'bottom';
export type OfferingsTableHorizontalPadding = 'default' | 'none';
export type OfferingsTableHeaderTextTransform = 'uppercase' | 'normal';

export interface OfferingsTableColumn {
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
	headerTextAlignment?: OfferingsTableTextAlignment;
	cellTextAlignment?: OfferingsTableTextAlignment;
	cellVerticalAlignment?: OfferingsTableVerticalAlignment;
	headerPaddingX?: OfferingsTableHorizontalPadding;
	cellPaddingX?: OfferingsTableHorizontalPadding;
	headerTextTransform?: OfferingsTableHeaderTextTransform;
	tabularNumbers?: boolean;
	rowHeader?: boolean;
}
