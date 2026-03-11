export interface HeaderHierarchyOption {
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

export interface HeaderHierarchySegment {
	key: string;
	label: string;
	href: string;
	menuAriaLabel: string;
	currentValue: string;
	options: HeaderHierarchyOption[];
	showMenu?: boolean;
	searchEnabled?: boolean;
	searchPlaceholder?: string;
	emptyText?: string;
}
