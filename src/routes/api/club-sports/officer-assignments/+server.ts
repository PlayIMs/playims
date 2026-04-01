import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId, requireAuthenticatedUserId } from '$lib/server/client-context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	createOfficerAssignmentSchema,
	type CreateOfficerAssignmentInput
} from '$lib/server/club-sports-validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Unable to save officer assignment right now.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.MANAGE_CLUB_SPORTS, { mutate: true })) {
		return json(
			{ success: false, error: 'Only managers, administrators, and developers can manage club sports.' },
			{ status: 403 }
		);
	}

	const parsed = createOfficerAssignmentSchema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const input: CreateOfficerAssignmentInput = parsed.data;
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	const titles = await dbOps.clubSportsOfficerTitles.getByClientId(clientId);
	const matchingTitle = titles.find((title) => title.id === input.assignment.titleId && title.isActive === 1);
	if (!matchingTitle?.id) {
		return json({ success: false, error: 'Officer title not found.' }, { status: 404 });
	}

	const created = await dbOps.clubSportsOfficerAssignments.create({
		clientId,
		clubSeasonId: input.assignment.clubSeasonId,
		clubId: input.assignment.clubId,
		clubLeagueId: input.assignment.clubLeagueId ?? null,
		clubTeamId: input.assignment.clubTeamId ?? null,
		titleId: input.assignment.titleId,
		userId: input.assignment.userId,
		createdUser: userId,
		updatedUser: userId
	});

	return json({ success: true, data: { assignment: created } });
};
