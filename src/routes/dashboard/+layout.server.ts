import {
	DASHBOARD_NAV_KEY_SET,
	mergeDashboardNavigationConfig,
	mergeDashboardNavigationLabels,
	mergeDashboardNavigationOrder,
	type DashboardNavKey
} from '$lib/dashboard/navigation';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getCentralDbOps, getTenantDbOps } from '$lib/server/database/context';
import type { LayoutServerLoad } from './$types';

const isDashboardNavKey = (value: string): value is DashboardNavKey =>
	DASHBOARD_NAV_KEY_SET.has(value as DashboardNavKey);

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	let navigation = mergeDashboardNavigationConfig();
	let organizations: Array<{
		clientId: string;
		clientName: string;
		clientSlug: string | null;
		role: string;
		isCurrent: boolean;
		isDefault: boolean;
	}> = [];

	if (platform?.env?.DB) {
		try {
			const clientId = requireAuthenticatedClientId(locals);
			const userId = requireAuthenticatedUserId(locals);
			const centralDb = getCentralDbOps({ locals, platform });
			const db = await getTenantDbOps({ locals, platform }, clientId);
			const [storedLabels, memberships] = await Promise.all([
				db.clientNavigationLabels.getByClientId(clientId),
				centralDb.userClients.listActiveForUserWithClientDetails(userId)
			]);

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
			organizations = memberships
				.map(({ membership, client }) => ({
					clientId: membership.clientId,
					clientName: client?.name?.trim() || 'Organization',
					clientSlug: client?.slug?.trim() || null,
					role: membership.role ?? 'participant',
					isCurrent: membership.clientId === clientId,
					isDefault: membership.isDefault === 1
				}))
				.toSorted((a, b) => {
					if (a.isCurrent && !b.isCurrent) return -1;
					if (!a.isCurrent && b.isCurrent) return 1;
					return a.clientName.localeCompare(b.clientName, 'en', { sensitivity: 'base' });
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
		organizations,
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
