import {
	orderDashboardNavigationItems,
	type DashboardNavKey,
	type DashboardNavigationLabels,
	type DashboardNavigationOrder
} from '$lib/dashboard/navigation';

export interface NavigationEditorRow {
	key: DashboardNavKey;
	defaultLabel: string;
	href: string;
	label: string;
	orderIndex: number;
	isDirty: boolean;
	isModifiedFromDefault: boolean;
}

const normalizeSearchText = (value: string): string => value.trim().toLowerCase();

export const countDirtyNavigationLabels = (
	labels: DashboardNavigationLabels,
	initialLabels: DashboardNavigationLabels
): number =>
	Object.keys(labels).filter((key) => {
		const navKey = key as DashboardNavKey;
		return labels[navKey] !== initialLabels[navKey];
	}).length;

export const getNavigationEditorRows = ({
	order,
	labels,
	initialLabels,
	query
}: {
	order: DashboardNavigationOrder;
	labels: DashboardNavigationLabels;
	initialLabels: DashboardNavigationLabels;
	query: string;
}): NavigationEditorRow[] => {
	const normalizedQuery = normalizeSearchText(query);

	return orderDashboardNavigationItems(order)
		.map((item, orderIndex) => ({
			key: item.key,
			defaultLabel: item.defaultLabel,
			href: item.href,
			label: labels[item.key],
			orderIndex,
			isDirty: labels[item.key] !== initialLabels[item.key],
			isModifiedFromDefault: labels[item.key] !== item.defaultLabel
		}))
		.filter((row) => {
			if (!normalizedQuery) {
				return true;
			}

			return [row.label, row.defaultLabel, row.key].some((value) =>
				normalizeSearchText(value).includes(normalizedQuery)
			);
		});
};
