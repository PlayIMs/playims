import {
	DASHBOARD_NAV_KEY_SET,
	mergeDashboardNavigationConfig,
	mergeDashboardNavigationLabels,
	mergeDashboardNavigationOrder,
	type DashboardNavKey
} from '$lib/dashboard/navigation';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import type { LayoutServerLoad } from './$types';

const isDashboardNavKey = (value: string): value is DashboardNavKey =>
	DASHBOARD_NAV_KEY_SET.has(value as DashboardNavKey);

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	let navigation = mergeDashboardNavigationConfig();

	if (platform?.env?.DB) {
		try {
			const clientId = requireAuthenticatedClientId(locals);
			const db = await getTenantDbOps({ locals, platform }, clientId);
			const storedLabels = await db.clientNavigationLabels.getByClientId(clientId);

			const overrides: Partial<Record<DashboardNavKey, string>> = {};
			const orderEntries: Array<{ key: DashboardNavKey; sortOrder: number }> = [];
			const legacyOrderEntries: DashboardNavKey[] = [];
			for (const entry of storedLabels) {
				const tabKey = entry.tabKey?.trim() ?? '';
				if (!isDashboardNavKey(tabKey)) {
					continue;
				}
				overrides[tabKey] = entry.label ?? '';
				if (typeof entry.sortOrder === 'number') {
					orderEntries.push({ key: tabKey, sortOrder: entry.sortOrder });
					continue;
				}
				legacyOrderEntries.push(tabKey);
			}

			const resolvedOrder =
				orderEntries.length > 0
					? mergeDashboardNavigationOrder(
							orderEntries.toSorted((a, b) => a.sortOrder - b.sortOrder).map((entry) => entry.key)
						)
					: mergeDashboardNavigationOrder(legacyOrderEntries);
			navigation = mergeDashboardNavigationConfig({
				labels: mergeDashboardNavigationLabels(overrides),
				order: resolvedOrder
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : '';
			if (
				!/no such table:\s*client_navigation_labels/i.test(message) &&
				!/no such column:\s*sort_order/i.test(message)
			) {
				console.error('Failed to load dashboard navigation labels:', error);
			}
		}
	}

	const firstName = locals.user?.firstName?.trim() ?? '';
	const lastName = locals.user?.lastName?.trim() ?? '';
	const fullName = `${firstName} ${lastName}`.trim();
	const baseRole = locals.user?.baseRole ?? locals.user?.role ?? null;
	const effectiveRole = locals.user?.role ?? locals.user?.baseRole ?? null;
	const canViewAsRole = locals.user?.canViewAsRole ?? false;
	const isViewingAsRole = locals.user?.isViewingAsRole ?? false;
	const viewAsRole = locals.user?.viewAsRole ?? null;

	return {
		viewer: {
			name: fullName.length > 0 ? fullName : null,
			email: locals.user?.email?.trim() ?? null
		},
		navigationLabels: navigation.labels,
		navigationOrder: navigation.order,
		authMode: {
			baseRole,
			effectiveRole,
			canViewAsRole,
			isViewingAsRole,
			viewAsRole
		}
	};
};
