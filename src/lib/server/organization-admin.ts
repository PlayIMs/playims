import { canAccessDashboardRouteForPermissions } from '$lib/dashboard/navigation';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import {
	applyMembershipRoleToLocals,
	buildPermissionSnapshot,
	canViewAsRole,
	PERMISSIONS,
	requirePermission
} from '$lib/server/auth/permissions';
import { accountCreateOrganizationSchema } from '$lib/server/auth/validation';
import { validateClientSlug } from '$lib/server/client-slug';
import { getCentralDbOps } from '$lib/server/database/context';
import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export type OrganizationAdminMembership = {
	clientId: string;
	clientName: string;
	clientSlug: string | null;
	role: string;
	permissions: ReturnType<typeof buildPermissionSnapshot>;
	isDefault: boolean;
	isCurrent: boolean;
	selfJoinEnabled: boolean;
	metadata: string | null;
	status: string;
	lastUsedAt: string | null;
};

const CREATE_ORGANIZATION_FIELD_LABELS: Record<string, string> = {
	organizationName: 'Organization name',
	organizationSlug: 'Organization slug',
	metadata: 'Metadata',
	membershipRole: 'Membership role'
};

const getCreateOrganizationValidationMessage = (
	issues: {
		path: PropertyKey[];
		message: string;
	}[],
	fallback: string
) => {
	const issue = issues[0];
	if (!issue) {
		return fallback;
	}

	const field = String(issue.path[0] ?? '');
	const label = CREATE_ORGANIZATION_FIELD_LABELS[field];
	if (label) {
		return `${label}: ${issue.message}`;
	}

	return issue.message || fallback;
};

const sortOrganizations = (
	organizations: OrganizationAdminMembership[]
): OrganizationAdminMembership[] =>
	organizations.toSorted((a, b) => {
		if (a.isCurrent && !b.isCurrent) return -1;
		if (!a.isCurrent && b.isCurrent) return 1;
		const aLastUsedAt = Date.parse(a.lastUsedAt ?? '');
		const bLastUsedAt = Date.parse(b.lastUsedAt ?? '');
		const aHasLastUsed = Number.isFinite(aLastUsedAt);
		const bHasLastUsed = Number.isFinite(bLastUsedAt);
		if (aHasLastUsed && bHasLastUsed && aLastUsedAt !== bLastUsedAt) {
			return bLastUsedAt - aLastUsedAt;
		}
		if (aHasLastUsed && !bHasLastUsed) return -1;
		if (!aHasLastUsed && bHasLastUsed) return 1;
		return a.clientName.localeCompare(b.clientName, 'en', { sensitivity: 'base' });
	});

export const loadOrganizationAdminMemberships = async (
	event: Pick<RequestEvent, 'locals' | 'platform'>
): Promise<OrganizationAdminMembership[]> => {
	if (!event.platform?.env?.DB) {
		return [];
	}

	const dbOps = getCentralDbOps(event);
	const activeClientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const memberships = await dbOps.userClients.listActiveForUserWithClientDetails(userId);

	return sortOrganizations(
		memberships.map(({ membership, client }) => ({
			clientId: membership.clientId,
			clientName: client?.name?.trim() || 'Organization',
			clientSlug: client?.slug?.trim() || null,
			role: membership.role ?? 'participant',
			permissions: buildPermissionSnapshot(membership.role ?? 'participant'),
			isDefault: membership.isDefault === 1,
			isCurrent: membership.clientId === activeClientId,
			selfJoinEnabled: client?.selfJoinEnabled === 1,
			metadata: client?.metadata?.trim() || null,
			status: client?.status?.trim() || 'active',
			lastUsedAt: membership.lastUsedAt ?? null
		}))
	);
};

export const createOrganizationAction = async (event: RequestEvent) => {
	if (!event.platform?.env?.DB) {
		return fail(500, { action: 'createOrganization', error: 'Database is not configured.' });
	}

	if (!event.locals.user || !event.locals.session) {
		return fail(401, { action: 'createOrganization', error: 'Authentication required.' });
	}
	if (!requirePermission(event.locals, PERMISSIONS.CREATE_ORGANIZATION, { mutate: true })) {
		return fail(403, {
			action: 'createOrganization',
			error: 'You do not have permission to create organizations in the current view mode.'
		});
	}

	const formData = await event.request.formData();
	const parsed = accountCreateOrganizationSchema.safeParse({
		organizationName: formData.get('organizationName')?.toString(),
		organizationSlug: formData.get('organizationSlug')?.toString(),
		selfJoinEnabled: formData.get('selfJoinEnabled')?.toString(),
		membershipRole: formData.get('membershipRole')?.toString(),
		switchToOrganization: formData.get('switchToOrganization')?.toString(),
		setDefaultOrganization: formData.get('setDefaultOrganization')?.toString(),
		metadata: formData.get('metadata')?.toString()
	});

	if (!parsed.success) {
		return fail(400, {
			action: 'createOrganization',
			error: getCreateOrganizationValidationMessage(
				parsed.error.issues,
				'Please provide valid organization details.'
			)
		});
	}

	const dbOps = getCentralDbOps(event);
	const userId = requireAuthenticatedUserId(event.locals);
	const nowIso = new Date().toISOString();

	const slugValidation = validateClientSlug(parsed.data.organizationSlug);
	if (!slugValidation.ok) {
		const slugError =
			slugValidation.code === 'CLIENT_SLUG_RESERVED'
				? 'That organization slug is reserved.'
				: slugValidation.code === 'CLIENT_SLUG_REQUIRED'
					? 'Organization slug is required.'
					: 'Organization slug must use letters, numbers, and dashes.';
		return fail(400, {
			action: 'createOrganization',
			error: slugError
		});
	}

	const existingClient = await dbOps.clients.getByNormalizedSlug(slugValidation.slug);
	if (existingClient?.id) {
		return fail(409, {
			action: 'createOrganization',
			error: 'That organization slug is already in use.'
		});
	}

	let createdClient: Awaited<ReturnType<typeof dbOps.clients.create>> | null = null;
	try {
		createdClient = await dbOps.clients.create({
			name: parsed.data.organizationName.trim(),
			slug: slugValidation.slug,
			selfJoinEnabled: parsed.data.selfJoinEnabled,
			metadata: parsed.data.metadata?.trim() || undefined,
			createdUser: userId,
			updatedUser: userId
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message === 'CLIENT_SLUG_RESERVED') {
			return fail(400, {
				action: 'createOrganization',
				error: 'That organization slug is reserved.'
			});
		}
		if (message === 'CLIENT_SLUG_INVALID' || message === 'CLIENT_SLUG_REQUIRED') {
			return fail(400, {
				action: 'createOrganization',
				error: 'Organization slug must use letters, numbers, and dashes.'
			});
		}
		return fail(500, {
			action: 'createOrganization',
			error: 'Unable to create organization right now.'
		});
	}

	if (!createdClient?.id) {
		return fail(500, {
			action: 'createOrganization',
			error: 'Unable to create organization right now.'
		});
	}

	const membership = await dbOps.userClients.ensureMembership({
		userId,
		clientId: createdClient.id,
		role: parsed.data.membershipRole,
		status: 'active',
		isDefault: parsed.data.setDefaultOrganization,
		createdUser: userId,
		updatedUser: userId
	});

	if (!membership) {
		return fail(500, {
			action: 'createOrganization',
			error: 'Organization created, but membership setup failed.'
		});
	}

	let switched = false;
	if (parsed.data.switchToOrganization && event.locals.session?.id) {
		const updatedSession = await dbOps.sessions.updateClientContext(
			event.locals.session.id,
			createdClient.id,
			nowIso
		);
		if (updatedSession) {
			switched = true;
			const roleContext = applyMembershipRoleToLocals(event, {
				clientId: createdClient.id,
				baseRole: membership.role
			});
			const pathname = event.url.pathname.trim();
			if (
				pathname.startsWith('/dashboard') &&
				!canAccessDashboardRouteForPermissions({
					pathname,
					permissions: buildPermissionSnapshot(roleContext.role)
				})
			) {
				throw redirect(303, '/dashboard');
			}
		}
	}

	return {
		action: 'createOrganization',
		success: switched
			? `Organization "${createdClient.name?.trim() || 'Organization'}" created and activated.`
			: `Organization "${createdClient.name?.trim() || 'Organization'}" created.`
	};
};
