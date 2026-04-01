import { hasPermission, PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { validateClientSlug } from '$lib/server/client-slug';
import { getCentralDbOps } from '$lib/server/database/context';
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const FIELD_LABELS: Record<string, string> = {
	organizationName: 'Organization name',
	organizationSlug: 'Organization slug',
	selfJoinEnabled: 'Self-join setting',
	metadata: 'Metadata'
};

const optionalMetadataSchema = z.preprocess((value) => {
	if (typeof value !== 'string') {
		return value;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}, z.string().trim().max(4000).optional());

const organizationSettingsSchema = z.object({
	organizationName: z.string().trim().min(2).max(120),
	organizationSlug: z.string().trim().min(2).max(120),
	selfJoinEnabled: z
		.enum(['0', '1'])
		.optional()
		.transform((value) => value === '1'),
	metadata: optionalMetadataSchema
});

const getValidationMessage = (
	issues: Array<{
		path: PropertyKey[];
		message: string;
	}>,
	fallback: string
) => {
	const issue = issues[0];
	if (!issue) {
		return fallback;
	}

	const field = String(issue.path[0] ?? '');
	const label = FIELD_LABELS[field];
	if (label) {
		return `${label}: ${issue.message}`;
	}

	return issue.message || fallback;
};

const toFieldErrors = (
	issues: Array<{
		path: PropertyKey[];
		message: string;
	}>
): Record<string, string> => {
	const fieldErrors: Record<string, string> = {};

	for (const issue of issues) {
		const key = String(issue.path[0] ?? '');
		if (!fieldErrors[key]) {
			fieldErrors[key] = issue.message;
		}
	}

	return fieldErrors;
};

const resolveReadOnlyMessage = (input: {
	canEditByMembership: boolean;
	canEditInCurrentView: boolean;
	isViewingAsRole: boolean;
}): string | null => {
	if (input.canEditByMembership && input.canEditInCurrentView) {
		return null;
	}

	if (input.canEditByMembership && input.isViewingAsRole) {
		return 'Switch back to your full role to update organization settings.';
	}

	return 'Only administrators and developers can update organization settings.';
};

const toSlugError = (code: string): string =>
	code === 'CLIENT_SLUG_REQUIRED'
		? 'Organization slug is required.'
		: code === 'CLIENT_SLUG_RESERVED'
			? 'That organization slug is reserved.'
			: 'Organization slug must use letters, numbers, and dashes.';

export const load: PageServerLoad = async (event) => {
	const { locals, platform } = event;

	if (!platform?.env?.DB) {
		return {
			organization: null,
			membership: null,
			canEditOrganization: false,
			readOnlyMessage: null,
			error: 'Database is unavailable.'
		};
	}

	const dbOps = getCentralDbOps(event);
	const clientId = requireAuthenticatedClientId(locals);
	const userId = requireAuthenticatedUserId(locals);
	const [organization, membership] = await Promise.all([
		dbOps.clients.getById(clientId),
		dbOps.userClients.getActiveMembership(userId, clientId)
	]);

	locals.requestLogMeta = {
		table: 'clients,user_clients',
		recordCount: organization?.id ? 1 : 0
	};

	const canEditByMembership =
		membership?.role != null &&
		hasPermission(membership.role, PERMISSIONS.EDIT_ORGANIZATION_DETAILS);
	const canEditInCurrentView = requirePermission(locals, PERMISSIONS.EDIT_ORGANIZATION_DETAILS, {
		mutate: true
	});

	if (!organization?.id || !membership) {
		return {
			organization: null,
			membership: null,
			canEditOrganization: false,
			readOnlyMessage: resolveReadOnlyMessage({
				canEditByMembership,
				canEditInCurrentView,
				isViewingAsRole: locals.user?.isViewingAsRole === true
			}),
			error: 'Unable to load the active organization.'
		};
	}

	return {
		organization: {
			id: organization.id,
			name: organization.name?.trim() || 'Organization',
			slug: organization.slug?.trim() || '',
			status: organization.status?.trim() || 'active',
			selfJoinEnabled: organization.selfJoinEnabled === 1,
			metadata: organization.metadata?.trim() || '',
			createdAt: organization.createdAt ?? null,
			updatedAt: organization.updatedAt ?? null,
			createdUser: organization.createdUser ?? null,
			updatedUser: organization.updatedUser ?? null,
			joinPath: organization.slug?.trim() ? `/${organization.slug.trim()}` : null
		},
		membership: {
			role: membership.role ?? 'participant',
			isDefault: membership.isDefault === 1
		},
		canEditOrganization: canEditByMembership && canEditInCurrentView,
		readOnlyMessage: resolveReadOnlyMessage({
			canEditByMembership,
			canEditInCurrentView,
			isViewingAsRole: locals.user?.isViewingAsRole === true
		}),
		error: null
	};
};

export const actions: Actions = {
	saveOrganization: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, {
				action: 'saveOrganization',
				error: 'Database is not configured.'
			});
		}

		const clientId = requireAuthenticatedClientId(event.locals);
		const userId = requireAuthenticatedUserId(event.locals);
		const dbOps = getCentralDbOps(event);
		const membership = await dbOps.userClients.getActiveMembership(userId, clientId);

		if (!membership) {
			return fail(403, {
				action: 'saveOrganization',
				error: 'You do not have access to this organization.'
			});
		}

		if (!hasPermission(membership.role, PERMISSIONS.EDIT_ORGANIZATION_DETAILS)) {
			return fail(403, {
				action: 'saveOrganization',
				error: 'Only administrators and developers can update organization settings.'
			});
		}

		if (!requirePermission(event.locals, PERMISSIONS.EDIT_ORGANIZATION_DETAILS, { mutate: true })) {
			return fail(403, {
				action: 'saveOrganization',
				error: 'You do not have permission to update settings in the current view mode.'
			});
		}

		const formData = await event.request.formData();
		const parsed = organizationSettingsSchema.safeParse({
			organizationName: formData.get('organizationName')?.toString(),
			organizationSlug: formData.get('organizationSlug')?.toString(),
			selfJoinEnabled: formData.get('selfJoinEnabled')?.toString(),
			metadata: formData.get('metadata')?.toString()
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'saveOrganization',
				error: getValidationMessage(
					parsed.error.issues,
					'Please provide valid organization details.'
				),
				fieldErrors: toFieldErrors(parsed.error.issues)
			});
		}

		const targetClient = await dbOps.clients.getById(clientId);
		if (!targetClient?.id) {
			return fail(404, {
				action: 'saveOrganization',
				error: 'Organization not found.'
			});
		}

		const slugValidation = validateClientSlug(parsed.data.organizationSlug);
		if (!slugValidation.ok) {
			const slugError = toSlugError(slugValidation.code);
			return fail(400, {
				action: 'saveOrganization',
				error: slugError,
				fieldErrors: {
					organizationSlug: slugError
				}
			});
		}

		const duplicateClient = await dbOps.clients.getByNormalizedSlug(slugValidation.slug);
		if (duplicateClient?.id && duplicateClient.id !== clientId) {
			return fail(409, {
				action: 'saveOrganization',
				error: 'That organization slug is already in use.',
				fieldErrors: {
					organizationSlug: 'That organization slug is already in use.'
				}
			});
		}

		try {
			const updated = await dbOps.clients.updateDetails(
				clientId,
				{
					name: parsed.data.organizationName.trim(),
					slug: slugValidation.slug,
					selfJoinEnabled: parsed.data.selfJoinEnabled,
					metadata: parsed.data.metadata?.trim() || undefined
				},
				userId
			);

			if (!updated?.id) {
				return fail(500, {
					action: 'saveOrganization',
					error: 'Unable to update organization settings right now.'
				});
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : '';
			if (
				message === 'CLIENT_SLUG_REQUIRED' ||
				message === 'CLIENT_SLUG_RESERVED' ||
				message === 'CLIENT_SLUG_INVALID'
			) {
				const slugError = toSlugError(message);
				return fail(400, {
					action: 'saveOrganization',
					error: slugError,
					fieldErrors: {
						organizationSlug: slugError
					}
				});
			}

			return fail(500, {
				action: 'saveOrganization',
				error: 'Unable to update organization settings right now.'
			});
		}

		return {
			action: 'saveOrganization',
			success: 'Organization settings updated.'
		};
	}
};
