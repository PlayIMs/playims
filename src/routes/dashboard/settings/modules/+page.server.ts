import {
	DASHBOARD_NAV_DEFAULT_LABELS,
	DASHBOARD_NAV_KEY_SET,
	mergeDashboardNavigationConfig,
	mergeDashboardNavigationLabels,
	mergeDashboardNavigationOrder,
	normalizeDashboardNavigationLabel,
	type DashboardNavKey
} from '$lib/dashboard/navigation';
import { canManageWrites } from '$lib/server/auth/permissions';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const MAX_NAV_LABEL_LENGTH = 25;

const isDashboardNavKey = (value: string): value is DashboardNavKey =>
	DASHBOARD_NAV_KEY_SET.has(value as DashboardNavKey);

const hasFieldErrors = (fieldErrors: Partial<Record<DashboardNavKey, string>>): boolean =>
	Object.keys(fieldErrors).length > 0;

const parseLabelsPayload = (
	value: FormDataEntryValue | null
): {
	labels: Partial<Record<DashboardNavKey, string>>;
	fieldErrors: Partial<Record<DashboardNavKey, string>>;
	error: string | null;
} => {
	if (typeof value !== 'string') {
		return {
			labels: {},
			fieldErrors: {},
			error: 'Navigation label payload is missing.'
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return {
			labels: {},
			fieldErrors: {},
			error: 'Navigation label payload is invalid JSON.'
		};
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return {
			labels: {},
			fieldErrors: {},
			error: 'Navigation label payload has an unsupported shape.'
		};
	}

	const labels: Partial<Record<DashboardNavKey, string>> = {};
	const fieldErrors: Partial<Record<DashboardNavKey, string>> = {};

	for (const [rawKey, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
		if (!isDashboardNavKey(rawKey)) {
			continue;
		}

		if (typeof rawValue !== 'string') {
			fieldErrors[rawKey] = 'Label must be text.';
			continue;
		}

		const normalized = normalizeDashboardNavigationLabel(rawValue);
		if (normalized.length === 0) {
			labels[rawKey] = DASHBOARD_NAV_DEFAULT_LABELS[rawKey];
			continue;
		}

		if (normalized.length > MAX_NAV_LABEL_LENGTH) {
			fieldErrors[rawKey] = `Use ${MAX_NAV_LABEL_LENGTH} characters or fewer.`;
			continue;
		}

		labels[rawKey] = normalized;
	}

	return {
		labels,
		fieldErrors,
		error: null
	};
};

const parseOrderPayload = (
	value: FormDataEntryValue | null
): {
	order: DashboardNavKey[];
	error: string | null;
} => {
	if (typeof value !== 'string') {
		return {
			order: mergeDashboardNavigationOrder(),
			error: 'Navigation order payload is missing.'
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return {
			order: mergeDashboardNavigationOrder(),
			error: 'Navigation order payload is invalid JSON.'
		};
	}

	if (!Array.isArray(parsed)) {
		return {
			order: mergeDashboardNavigationOrder(),
			error: 'Navigation order payload has an unsupported shape.'
		};
	}

	return {
		order: mergeDashboardNavigationOrder(parsed as string[]),
		error: null
	};
};

const isMissingNavigationOrderSchemaError = (message: string): boolean =>
	/no such column:\s*sort_order/i.test(message) ||
	/has no column named\s+sort_order/i.test(message) ||
	/no such table:\s*client_navigation_labels/i.test(message);

export const load: PageServerLoad = async ({ locals }) => {
	return {
		canEditNavigation: canManageWrites(locals),
		maxLabelLength: MAX_NAV_LABEL_LENGTH
	};
};

export const actions: Actions = {
	saveNavigationOrder: async ({ request, locals, platform }) => {
		if (!platform?.env?.DB) {
			return fail(500, {
				action: 'saveNavigationOrder',
				error: 'Database is not configured.'
			});
		}

		if (!canManageWrites(locals)) {
			return fail(403, {
				action: 'saveNavigationOrder',
				error: 'You do not have permission to update settings in the current view mode.'
			});
		}

		const formData = await request.formData();
		const parsedOrder = parseOrderPayload(formData.get('orderJson'));
		if (parsedOrder.error) {
			return fail(400, {
				action: 'saveNavigationOrder',
				error: parsedOrder.error
			});
		}

		const clientId = requireAuthenticatedClientId(locals);
		const userId = requireAuthenticatedUserId(locals);
		const db = await getTenantDbOps({ locals, platform }, clientId);
		const storedLabels = await db.clientNavigationLabels.getByClientId(clientId);
		const storedOverrides: Partial<Record<DashboardNavKey, string>> = {};
		for (const entry of storedLabels) {
			const tabKey = entry.tabKey?.trim() ?? '';
			if (!isDashboardNavKey(tabKey)) {
				continue;
			}
			storedOverrides[tabKey] = entry.label ?? '';
		}

		const merged = mergeDashboardNavigationConfig({
			labels: mergeDashboardNavigationLabels(storedOverrides),
			order: parsedOrder.order
		});

		try {
			await db.clientNavigationLabels.replaceAllForClient(
				clientId,
				merged.labels,
				merged.order,
				userId
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : '';
			if (isMissingNavigationOrderSchemaError(message)) {
				return fail(500, {
					action: 'saveNavigationOrder',
					error: 'Settings migration is required before saving sidebar order.'
				});
			}
			throw error;
		}

		return {
			action: 'saveNavigationOrder',
			success: 'Sidebar stack order updated.',
			navigationLabels: merged.labels,
			navigationOrder: merged.order
		};
	},

	saveNavigationLabels: async ({ request, locals, platform }) => {
		if (!platform?.env?.DB) {
			return fail(500, {
				action: 'saveNavigationLabels',
				error: 'Database is not configured.'
			});
		}

		if (!canManageWrites(locals)) {
			return fail(403, {
				action: 'saveNavigationLabels',
				error: 'You do not have permission to update settings in the current view mode.'
			});
		}

		const formData = await request.formData();
		const parsed = parseLabelsPayload(formData.get('labelsJson'));
		if (parsed.error) {
			return fail(400, {
				action: 'saveNavigationLabels',
				error: parsed.error
			});
		}
		const parsedOrder = parseOrderPayload(formData.get('orderJson'));
		if (parsedOrder.error) {
			return fail(400, {
				action: 'saveNavigationLabels',
				error: parsedOrder.error
			});
		}

		if (hasFieldErrors(parsed.fieldErrors)) {
			return fail(400, {
				action: 'saveNavigationLabels',
				error: 'Please fix the highlighted labels and save again.',
				fieldErrors: parsed.fieldErrors
			});
		}

		const clientId = requireAuthenticatedClientId(locals);
		const userId = requireAuthenticatedUserId(locals);
		const db = await getTenantDbOps({ locals, platform }, clientId);
		const merged = mergeDashboardNavigationConfig({
			labels: mergeDashboardNavigationLabels(parsed.labels),
			order: parsedOrder.order
		});

		try {
			await db.clientNavigationLabels.replaceAllForClient(
				clientId,
				merged.labels,
				merged.order,
				userId
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : '';
			if (isMissingNavigationOrderSchemaError(message)) {
				return fail(500, {
					action: 'saveNavigationLabels',
					error: 'Settings migration is required before saving sidebar order.'
				});
			}
			throw error;
		}

		return {
			action: 'saveNavigationLabels',
			success: 'Sidebar labels updated.',
			navigationLabels: merged.labels,
			navigationOrder: merged.order
		};
	}
};
