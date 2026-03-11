export type OfferingsTableTextAlignment = 'left' | 'center' | 'right';
export type OfferingsTableVerticalAlignment = 'top' | 'middle' | 'bottom';
export type OfferingsTableHorizontalPadding = 'default' | 'none';
export type OfferingsTableHeaderTextTransform = 'uppercase' | 'normal';

export interface OfferingsTableColumn {
	key: string;
	label: string;
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
