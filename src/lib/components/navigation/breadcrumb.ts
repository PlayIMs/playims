export interface BreadcrumbOption {
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

export interface BreadcrumbSegment {
	key: string;
	label: string;
	href: string;
	menuAriaLabel: string;
	currentValue: string;
	options: BreadcrumbOption[];
	showMenu?: boolean;
	searchEnabled?: boolean;
	searchPlaceholder?: string;
	emptyText?: string;
}
