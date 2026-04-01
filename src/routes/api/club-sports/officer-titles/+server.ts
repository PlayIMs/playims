import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId, requireAuthenticatedUserId } from '$lib/server/client-context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	createOfficerTitleSchema,
	updateOfficerTitleSchema,
	type UpdateOfficerTitleInput
} from '$lib/server/club-sports-validation';
import { normalizeClubSportsSlug } from '$lib/server/club-sports-scope';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Unable to save officer title right now.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.MANAGE_CLUB_SPORTS, { mutate: true })) {
		return json(
			{ success: false, error: 'Only managers, administrators, and developers can manage club sports.' },
			{ status: 403 }
		);
	}

	const parsed = createOfficerTitleSchema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);
	const created = await dbOps.clubSportsOfficerTitles.create({
		clientId,
		clubId: parsed.data.title.clubId ?? null,
		name: parsed.data.title.name,
		slug: normalizeClubSportsSlug(parsed.data.title.slug),
		scope: parsed.data.title.scope,
		isBuiltIn: 0,
		isOrgManaged: parsed.data.title.clubId ? 0 : 1,
		isActive: parsed.data.title.isActive ? 1 : 0,
		createdUser: userId,
		updatedUser: userId
	});
	return json({ success: true, data: { title: created } });
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Unable to save officer title right now.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.MANAGE_CLUB_SPORTS, { mutate: true })) {
		return json(
			{ success: false, error: 'Only managers, administrators, and developers can manage club sports.' },
			{ status: 403 }
		);
	}

	const parsed = updateOfficerTitleSchema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const input: UpdateOfficerTitleInput = parsed.data;
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);
	const existing = await dbOps.clubSportsOfficerTitles.getByClientIdAndId(clientId, input.titleId);
	if (!existing?.id) {
		return json({ success: false, error: 'Officer title not found.' }, { status: 404 });
	}
	if (existing.isOrgManaged === 1) {
		return json(
			{
				success: false,
				error: 'This is an organization-managed officer title and cannot be edited from the club endpoint.'
			},
			{ status: 403 }
		);
	}

	const updated = await dbOps.clubSportsOfficerTitles.updateByClientIdAndId(clientId, input.titleId, {
		name: input.title.name,
		slug: normalizeClubSportsSlug(input.title.slug),
		scope: input.title.scope,
		isActive: input.title.isActive ? 1 : 0,
		updatedUser: userId
	});
	return json({ success: true, data: { title: updated } });
};
