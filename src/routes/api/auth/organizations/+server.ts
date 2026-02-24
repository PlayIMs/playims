import { canViewAsRole, isAdminLikeRole, normalizeRole } from '$lib/server/auth/rbac';
import { normalizeClientSlug, validateClientSlug } from '$lib/server/client-slug';
import { getCentralDbOps } from '$lib/server/database/context';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const updateOrganizationSchema = z.object({
	action: z.literal('update-details'),
	clientId: z.string().trim().uuid('Please choose a valid organization.'),
	organizationName: z.string().trim().min(2).max(120),
	organizationSlug: z.string().trim().min(2).max(120),
	selfJoinEnabled: z.boolean(),
	metadata: z
		.string()
		.max(4000)
		.optional()
		.transform((value) => value?.trim() ?? '')
});

const setDefaultOrganizationSchema = z.object({
	action: z.literal('set-default'),
	clientId: z.string().trim().uuid('Please choose a valid organization.')
});

const leaveOrganizationSchema = z.object({
	clientId: z.string().trim().uuid('Please choose a valid organization.'),
	confirmSlug: z.string().trim().min(1).max(120)
});

type ManageOrganizationResponse = {
	success: boolean;
	data?: {
		clientId?: string | null;
		activeClientId?: string | null;
		defaultClientId?: string | null;
	};
	error?: string;
	fieldErrors?: Record<string, string[]>;
};

const toFieldErrorMap = (
	issues: Array<{
		path: Array<PropertyKey>;
		message: string;
	}>
): Record<string, string[]> => {
	const fieldErrors: Record<string, string[]> = {};

	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) {
			fieldErrors[key] = [];
		}
		fieldErrors[key].push(issue.message);
	}

	return fieldErrors;
};

const toOrgManageError = (
	status: number,
	error: string,
	fieldErrors?: Record<string, string[]>
): Response =>
	json(
		{
			success: false,
			error,
			fieldErrors
		} satisfies ManageOrganizationResponse,
		{ status }
	);

const resolveActiveClientId = (locals: App.Locals): string =>
	locals.session?.activeClientId ?? locals.user?.clientId ?? '';

export const PATCH: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return toOrgManageError(500, 'Authentication is unavailable.');
	}

	if (!event.locals.user || !event.locals.session) {
		return toOrgManageError(401, 'Authentication required.');
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return toOrgManageError(400, 'Invalid request payload.');
	}

	const actionValue =
		body && typeof body === 'object' && !Array.isArray(body)
			? ((body as Record<string, unknown>)['action'] as string | undefined)
			: undefined;

	const dbOps = getCentralDbOps(event);
	const userId = event.locals.user.id;

	if (actionValue === 'set-default') {
		const parsed = setDefaultOrganizationSchema.safeParse(body);
		if (!parsed.success) {
			return toOrgManageError(400, 'Invalid request payload.', toFieldErrorMap(parsed.error.issues));
		}

		const membership = await dbOps.userClients.getActiveMembership(userId, parsed.data.clientId);
		if (!membership) {
			return toOrgManageError(403, 'You do not have access to that organization.');
		}

		const updated = await dbOps.userClients.setDefaultMembership(userId, parsed.data.clientId);
		if (!updated) {
			return toOrgManageError(500, 'Unable to update default organization right now.');
		}

		return json({
			success: true,
			data: {
				clientId: parsed.data.clientId,
				activeClientId: resolveActiveClientId(event.locals),
				defaultClientId: parsed.data.clientId
			}
		} satisfies ManageOrganizationResponse);
	}

	if (actionValue !== 'update-details') {
		return toOrgManageError(400, 'Invalid request payload.');
	}

	const parsed = updateOrganizationSchema.safeParse(body);
	if (!parsed.success) {
		return toOrgManageError(400, 'Invalid request payload.', toFieldErrorMap(parsed.error.issues));
	}

	const membership = await dbOps.userClients.getActiveMembership(userId, parsed.data.clientId);
	if (!membership) {
		return toOrgManageError(403, 'You do not have access to that organization.');
	}
	if (!isAdminLikeRole(membership.role)) {
		return toOrgManageError(
			403,
			'Only administrators and developers can edit organization settings.'
		);
	}

	const targetClient = await dbOps.clients.getById(parsed.data.clientId);
	if (!targetClient?.id) {
		return toOrgManageError(404, 'Organization not found.');
	}

	const slugValidation = validateClientSlug(parsed.data.organizationSlug);
	if (!slugValidation.ok) {
		const slugMessage =
			slugValidation.code === 'CLIENT_SLUG_REQUIRED'
				? 'Organization slug is required.'
				: slugValidation.code === 'CLIENT_SLUG_RESERVED'
					? 'That organization slug is reserved.'
					: 'Organization slug must use letters, numbers, and dashes.';
		return toOrgManageError(400, slugMessage, {
			organizationSlug: [slugMessage]
		});
	}

	const duplicateClient = await dbOps.clients.getByNormalizedSlug(slugValidation.slug);
	if (duplicateClient?.id && duplicateClient.id !== parsed.data.clientId) {
		return toOrgManageError(409, 'That organization slug is already in use.', {
			organizationSlug: ['That organization slug is already in use.']
		});
	}

	let updatedClient = null as Awaited<ReturnType<typeof dbOps.clients.updateDetails>> | null;
	try {
		updatedClient = await dbOps.clients.updateDetails(
			parsed.data.clientId,
			{
				name: parsed.data.organizationName,
				slug: slugValidation.slug,
				selfJoinEnabled: parsed.data.selfJoinEnabled,
				metadata: parsed.data.metadata
			},
			userId
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message === 'CLIENT_SLUG_RESERVED') {
			return toOrgManageError(400, 'That organization slug is reserved.', {
				organizationSlug: ['That organization slug is reserved.']
			});
		}
		if (message === 'CLIENT_SLUG_INVALID' || message === 'CLIENT_SLUG_REQUIRED') {
			return toOrgManageError(400, 'Organization slug must use letters, numbers, and dashes.', {
				organizationSlug: ['Organization slug must use letters, numbers, and dashes.']
			});
		}
		return toOrgManageError(500, 'Unable to update organization right now.');
	}

	if (!updatedClient?.id) {
		return toOrgManageError(500, 'Unable to update organization right now.');
	}

	return json({
		success: true,
		data: {
			clientId: updatedClient.id,
			activeClientId: resolveActiveClientId(event.locals)
		}
	} satisfies ManageOrganizationResponse);
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return toOrgManageError(500, 'Authentication is unavailable.');
	}

	if (!event.locals.user || !event.locals.session) {
		return toOrgManageError(401, 'Authentication required.');
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return toOrgManageError(400, 'Invalid request payload.');
	}

	const parsed = leaveOrganizationSchema.safeParse(body);
	if (!parsed.success) {
		return toOrgManageError(400, 'Invalid request payload.', toFieldErrorMap(parsed.error.issues));
	}

	const dbOps = getCentralDbOps(event);
	const userId = event.locals.user.id;
	const activeMemberships = await dbOps.userClients.listActiveForUser(userId);
	const membership = activeMemberships.find(
		(userClient) => userClient.clientId === parsed.data.clientId
	);
	if (!membership) {
		return toOrgManageError(403, 'You do not have access to that organization.');
	}
	if (activeMemberships.length <= 1) {
		return toOrgManageError(400, 'You cannot leave your only active organization.');
	}

	const targetClient = await dbOps.clients.getById(parsed.data.clientId);
	if (!targetClient?.id) {
		return toOrgManageError(404, 'Organization not found.');
	}

	const expectedSlug = normalizeClientSlug(targetClient.slug || targetClient.name || '');
	if (normalizeClientSlug(parsed.data.confirmSlug) !== expectedSlug) {
		return toOrgManageError(400, 'Organization slug confirmation did not match.', {
			confirmSlug: ['Enter the exact organization slug to confirm leaving.']
		});
	}

	const deactivated = await dbOps.userClients.deactivateMembership(userId, parsed.data.clientId, userId);
	if (!deactivated) {
		return toOrgManageError(500, 'Unable to leave organization right now.');
	}

	let remainingMemberships = activeMemberships.filter(
		(userClient) => userClient.clientId !== parsed.data.clientId
	);
	if (remainingMemberships.length === 0) {
		return toOrgManageError(500, 'Unable to resolve another active organization.');
	}

	if (membership.isDefault === 1 || !remainingMemberships.some((userClient) => userClient.isDefault === 1)) {
		const fallbackDefault = remainingMemberships[0];
		if (!fallbackDefault?.clientId) {
			return toOrgManageError(500, 'Unable to resolve another active organization.');
		}
		const updatedDefault = await dbOps.userClients.setDefaultMembership(userId, fallbackDefault.clientId);
		if (updatedDefault?.clientId) {
			remainingMemberships = remainingMemberships.map((userClient) => ({
				...userClient,
				isDefault: userClient.clientId === updatedDefault.clientId ? 1 : 0
			}));
		}
	}

	if (parsed.data.clientId === event.locals.session.activeClientId) {
		const fallbackMembership =
			remainingMemberships.find((userClient) => userClient.isDefault === 1) ??
			remainingMemberships[0] ??
			null;
		if (!fallbackMembership?.clientId) {
			return toOrgManageError(500, 'Unable to resolve another active organization.');
		}

		const nowIso = new Date().toISOString();
		const switched = await dbOps.sessions.updateClientContext(
			event.locals.session.id,
			fallbackMembership.clientId,
			nowIso
		);
		if (!switched) {
			return toOrgManageError(500, 'Unable to switch organizations right now.');
		}

		const resolvedRole = normalizeRole(fallbackMembership.role);
		const canViewAsRoleEnabled = canViewAsRole(resolvedRole);
		event.locals.session = {
			...event.locals.session,
			clientId: fallbackMembership.clientId,
			activeClientId: fallbackMembership.clientId,
			role: resolvedRole,
			baseRole: resolvedRole,
			canViewAsRole: canViewAsRoleEnabled,
			isViewingAsRole: false,
			viewAsRole: null
		};
		event.locals.user = {
			...event.locals.user,
			clientId: fallbackMembership.clientId,
			role: resolvedRole,
			baseRole: resolvedRole,
			canViewAsRole: canViewAsRoleEnabled,
			isViewingAsRole: false,
			viewAsRole: null
		};
	}

	const defaultMembership =
		remainingMemberships.find((userClient) => userClient.isDefault === 1) ?? remainingMemberships[0];

	return json({
		success: true,
		data: {
			clientId: parsed.data.clientId,
			activeClientId: resolveActiveClientId(event.locals),
			defaultClientId: defaultMembership?.clientId ?? null
		}
	} satisfies ManageOrganizationResponse);
};
