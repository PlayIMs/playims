export const DASHBOARD_NAV_ITEMS = [
	{ key: 'dashboard', defaultLabel: 'Dashboard', href: '/dashboard' },
	{ key: 'schedule', defaultLabel: 'Schedule', href: '/dashboard/schedule' },
	{
		key: 'offerings',
		defaultLabel: 'Intramural Offerings',
		href: '/dashboard/offerings'
	},
	{ key: 'clubSports', defaultLabel: 'Club Sports', href: '/dashboard/clubs' },
	{ key: 'memberManagement', defaultLabel: 'Member Management', href: '/dashboard/members' },
	{
		key: 'communicationCenter',
		defaultLabel: 'Communication Center',
		href: '/dashboard/communications'
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
export type DashboardPermissionSnapshot = Record<string, boolean>;

const DEV_ONLY_ROUTE_PREFIX = '/dashboard/dev';
const ACCOUNT_ROUTE_PREFIX = '/dashboard/account';
const NOTIFICATIONS_ROUTE_PREFIX = '/dashboard/settings/notifications';
const NAV_PRELOAD_DATA_BY_KEY: Partial<Record<DashboardNavKey, 'off'>> = {
	communicationCenter: 'off'
};

const NAV_ITEM_PERMISSION: Record<DashboardNavKey, string> = {
	dashboard: 'VIEW_DASHBOARD_HOME',
	schedule: 'VIEW_SCHEDULE',
	offerings: 'VIEW_OFFERINGS',
	clubSports: 'VIEW_CLUB_SPORTS',
	memberManagement: 'VIEW_MEMBER_MANAGEMENT',
	communicationCenter: 'VIEW_COMMUNICATION_CENTER',
	facilities: 'VIEW_FACILITIES',
	equipmentCheckout: 'VIEW_EQUIPMENT_CHECKOUT',
	payments: 'VIEW_PAYMENTS',
	forms: 'VIEW_FORMS',
	reports: 'VIEW_REPORTS',
	settings: 'VIEW_SETTINGS'
};

const DASHBOARD_ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
	{ prefix: '/dashboard/members', permission: 'VIEW_MEMBER_MANAGEMENT' },
	{ prefix: '/dashboard/facilities', permission: 'VIEW_FACILITIES' },
	{ prefix: '/dashboard/communications', permission: 'VIEW_COMMUNICATION_CENTER' },
	{ prefix: '/dashboard/payments', permission: 'VIEW_PAYMENTS' },
	{ prefix: '/dashboard/forms', permission: 'VIEW_FORMS' },
	{ prefix: '/dashboard/reports', permission: 'VIEW_REPORTS' },
	{ prefix: '/dashboard/settings', permission: 'VIEW_SETTINGS' },
	{ prefix: '/dashboard/offerings', permission: 'VIEW_OFFERINGS' },
	{ prefix: '/dashboard/clubs', permission: 'VIEW_CLUB_SPORTS' },
	{ prefix: '/dashboard/schedule', permission: 'VIEW_SCHEDULE' }
];

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

const hasPermission = (permissions: DashboardPermissionSnapshot, permission: string): boolean =>
	permissions[permission] === true;

export const filterDashboardNavigationItemsForPermissions = ({
	items,
	permissions
}: {
	items: readonly DashboardNavItem[];
	permissions: DashboardPermissionSnapshot;
}): DashboardNavItem[] => {
	return items.filter((item) => hasPermission(permissions, NAV_ITEM_PERMISSION[item.key]));
};

export const canAccessDashboardRouteForPermissions = ({
	pathname,
	permissions
}: {
	pathname: string;
	permissions: DashboardPermissionSnapshot;
}): boolean => {
	const normalizedPath = pathname.trim();
	if (normalizedPath.length === 0) {
		return true;
	}

	if (
		normalizedPath === DEV_ONLY_ROUTE_PREFIX ||
		normalizedPath.startsWith(`${DEV_ONLY_ROUTE_PREFIX}/`)
	) {
		return hasPermission(permissions, 'ACCESS_DEV_TOOLS');
	}

	if (
		normalizedPath === ACCOUNT_ROUTE_PREFIX ||
		normalizedPath.startsWith(`${ACCOUNT_ROUTE_PREFIX}/`)
	) {
		return hasPermission(permissions, 'VIEW_ACCOUNT');
	}

	if (
		normalizedPath === NOTIFICATIONS_ROUTE_PREFIX ||
		normalizedPath.startsWith(`${NOTIFICATIONS_ROUTE_PREFIX}/`)
	) {
		return hasPermission(permissions, 'VIEW_NOTIFICATIONS');
	}

	for (const entry of DASHBOARD_ROUTE_PERMISSIONS) {
		if (
			normalizedPath === entry.prefix ||
			normalizedPath.startsWith(`${entry.prefix}/`)
		) {
			return hasPermission(permissions, entry.permission);
		}
	}

	return hasPermission(permissions, 'VIEW_DASHBOARD_HOME');
};

export const getDashboardNavigationPreloadData = (
	key: DashboardNavKey
): 'off' | undefined => NAV_PRELOAD_DATA_BY_KEY[key];

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
