export const DASHBOARD_NAV_ITEMS = [
	{ key: 'dashboard', defaultLabel: 'Dashboard', href: '/dashboard' },
	{ key: 'schedule', defaultLabel: 'Schedule', href: '/dashboard/schedule' },
	{
		key: 'offerings',
		defaultLabel: 'Intramural Offerings',
		href: '/dashboard/offerings'
	},
	{ key: 'clubSports', defaultLabel: 'Club Sports', href: '#' },
	{ key: 'memberManagement', defaultLabel: 'Member Management', href: '/dashboard/members' },
	{
		key: 'communicationCenter',
		defaultLabel: 'Communication Center',
		href: '#'
	},
	{ key: 'facilities', defaultLabel: 'Facilities', href: '/dashboard/facilities' },
	{ key: 'equipmentCheckout', defaultLabel: 'Equipment Checkout', href: '#' },
	{ key: 'payments', defaultLabel: 'Payments', href: '#' },
	{ key: 'forms', defaultLabel: 'Forms', href: '#' },
	{ key: 'reports', defaultLabel: 'Reports', href: '#' },
	{ key: 'settings', defaultLabel: 'Settings', href: '/dashboard/settings' }
] as const;

export type DashboardNavItem = (typeof DASHBOARD_NAV_ITEMS)[number];
export type DashboardNavKey = DashboardNavItem['key'];
export type DashboardNavigationLabels = Record<DashboardNavKey, string>;
export type DashboardNavigationOrder = DashboardNavKey[];
export type DashboardNavigationConfig = {
	labels: DashboardNavigationLabels;
	order: DashboardNavigationOrder;
};
export type DashboardAuthRole = 'participant' | 'manager' | 'admin' | 'dev';

const PARTICIPANT_VIEW_HIDDEN_NAV_KEYS = new Set<DashboardNavKey>([
	'memberManagement',
	'facilities',
	'payments',
	'forms',
	'reports',
	'settings'
]);
const PARTICIPANT_VIEW_HIDDEN_ROUTE_PREFIXES = [
	'/dashboard/members',
	'/dashboard/facilities',
	'/dashboard/payments',
	'/dashboard/forms',
	'/dashboard/reports',
	'/dashboard/settings'
] as const;
const DEV_ONLY_ROUTE_PREFIX = '/dashboard/dev';

const collapseWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ');

const buildDefaultLabelRecord = (): DashboardNavigationLabels => {
	const labels = {} as DashboardNavigationLabels;
	for (const item of DASHBOARD_NAV_ITEMS) {
		labels[item.key] = item.defaultLabel;
	}
	return labels;
};

export const DASHBOARD_NAV_DEFAULT_LABELS = buildDefaultLabelRecord();

export const DASHBOARD_NAV_KEYS = DASHBOARD_NAV_ITEMS.map((item) => item.key) as DashboardNavKey[];
export const DASHBOARD_NAV_KEY_SET = new Set<DashboardNavKey>(DASHBOARD_NAV_KEYS);
export const DASHBOARD_NAV_DEFAULT_ORDER = [...DASHBOARD_NAV_KEYS] as DashboardNavigationOrder;

export const normalizeDashboardNavigationLabel = (value: string): string => collapseWhitespace(value);

export const getDefaultDashboardNavigationLabels = (): DashboardNavigationLabels => ({
	...DASHBOARD_NAV_DEFAULT_LABELS
});

export const getDefaultDashboardNavigationOrder = (): DashboardNavigationOrder => [
	...DASHBOARD_NAV_DEFAULT_ORDER
];

export const mergeDashboardNavigationLabels = (
	overrides?: Partial<Record<DashboardNavKey, string>> | null
): DashboardNavigationLabels => {
	const merged = getDefaultDashboardNavigationLabels();
	if (!overrides) {
		return merged;
	}

	for (const key of DASHBOARD_NAV_KEYS) {
		const override = overrides[key];
		if (typeof override !== 'string') {
			continue;
		}

		const normalized = normalizeDashboardNavigationLabel(override);
		if (normalized.length > 0) {
			merged[key] = normalized;
		}
	}

	return merged;
};

export const mergeDashboardNavigationOrder = (
	order?: readonly DashboardNavKey[] | readonly string[] | null
): DashboardNavigationOrder => {
	const merged: DashboardNavKey[] = [];
	const seen = new Set<DashboardNavKey>();

	if (Array.isArray(order)) {
		for (const entry of order) {
			if (typeof entry !== 'string') {
				continue;
			}

			const key = entry.trim();
			if (!DASHBOARD_NAV_KEY_SET.has(key as DashboardNavKey)) {
				continue;
			}

			const normalizedKey = key as DashboardNavKey;
			if (seen.has(normalizedKey)) {
				continue;
			}

			seen.add(normalizedKey);
			merged.push(normalizedKey);
		}
	}

	for (const key of DASHBOARD_NAV_DEFAULT_ORDER) {
		if (seen.has(key)) {
			continue;
		}
		merged.push(key);
		seen.add(key);
	}

	return merged;
};

export const mergeDashboardNavigationConfig = (input?: {
	labels?: Partial<Record<DashboardNavKey, string>> | null;
	order?: readonly DashboardNavKey[] | readonly string[] | null;
}): DashboardNavigationConfig => ({
	labels: mergeDashboardNavigationLabels(input?.labels),
	order: mergeDashboardNavigationOrder(input?.order)
});

export const orderDashboardNavigationItems = (
	order?: readonly DashboardNavKey[] | readonly string[] | null
): DashboardNavItem[] => {
	const itemsByKey = new Map(DASHBOARD_NAV_ITEMS.map((item) => [item.key, item]));
	return mergeDashboardNavigationOrder(order)
		.map((key) => itemsByKey.get(key))
		.filter((item): item is DashboardNavItem => Boolean(item));
};

export const filterDashboardNavigationItemsForAuthMode = ({
	items,
	effectiveRole,
	isViewingAsRole
}: {
	items: readonly DashboardNavItem[];
	effectiveRole: DashboardAuthRole;
	isViewingAsRole: boolean;
}): DashboardNavItem[] => {
	if (!isViewingAsRole || effectiveRole !== 'participant') {
		return [...items];
	}

	return items.filter((item) => !PARTICIPANT_VIEW_HIDDEN_NAV_KEYS.has(item.key));
};

export const canAccessDashboardRouteForAuthMode = ({
	pathname,
	effectiveRole,
	isViewingAsRole
}: {
	pathname: string;
	effectiveRole: DashboardAuthRole;
	isViewingAsRole: boolean;
}): boolean => {
	const normalizedPath = pathname.trim();
	if (normalizedPath.length === 0) {
		return true;
	}

	if (
		normalizedPath === DEV_ONLY_ROUTE_PREFIX ||
		normalizedPath.startsWith(`${DEV_ONLY_ROUTE_PREFIX}/`)
	) {
		return effectiveRole === 'dev';
	}

	if (!isViewingAsRole || effectiveRole !== 'participant') {
		return true;
	}

	return !PARTICIPANT_VIEW_HIDDEN_ROUTE_PREFIXES.some(
		(prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
	);
};

export const toDashboardNavigationOverrides = (
	labels: Partial<Record<DashboardNavKey, string>>
): Partial<Record<DashboardNavKey, string>> => {
	const normalized = mergeDashboardNavigationLabels(labels);
	const overrides: Partial<Record<DashboardNavKey, string>> = {};
	for (const key of DASHBOARD_NAV_KEYS) {
		const value = normalized[key];
		if (value !== DASHBOARD_NAV_DEFAULT_LABELS[key]) {
			overrides[key] = value;
		}
	}
	return overrides;
};
