import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId, requireAuthenticatedUserId } from '$lib/server/client-context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	createClubTeamSchema,
	type CreateClubTeamInput
} from '$lib/server/club-sports-validation';
import {
	normalizeClubSportsSlug,
	resolveClubLeagueForParams,
	resolveClubSeasonForParams
} from '$lib/server/club-sports-scope';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Unable to save club team right now.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.MANAGE_CLUB_SPORTS, { mutate: true })) {
		return json(
			{ success: false, error: 'Only managers, administrators, and developers can manage club sports.' },
			{ status: 403 }
		);
	}

	const parsed = createClubTeamSchema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const input: CreateClubTeamInput = parsed.data;
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const season = await resolveClubSeasonForParams(dbOps, clientId, event.params.seasonSlug);
		if (!season?.id) {
			return json({ success: false, error: 'Club season not found.' }, { status: 404 });
		}

		const resolved = await resolveClubLeagueForParams(
			dbOps,
			clientId,
			season,
			'',
			event.params.leagueSlug
		);
		const club = resolved?.club;
		const league = resolved?.league;
		if (!club?.id || !league?.id) {
			return json({ success: false, error: 'Club league not found.' }, { status: 404 });
		}

		const existingTeams = await dbOps.clubSportsTeams.getByLeagueId(league.id);
		const duplicateTeam = existingTeams.find(
			(team) => normalizeClubSportsSlug(team.slug || team.name) === normalizeClubSportsSlug(input.team.slug)
		);
		if (duplicateTeam) {
			return json(
				{
					success: false,
					error: 'A team with this slug already exists for the selected league.',
					fieldErrors: {
						'team.slug': ['A team with this slug already exists for the selected league.']
					}
				},
				{ status: 400 }
			);
		}

		const createdTeam = await dbOps.clubSportsTeams.create({
			clientId,
			clubSeasonId: season.id,
			clubId: club.id,
			clubLeagueId: league.id,
			name: input.team.name,
			slug: normalizeClubSportsSlug(input.team.slug),
			description: input.team.description,
			teamColor: input.team.teamColor,
			isActive: input.team.isActive ? 1 : 0,
			createdUser: userId,
			updatedUser: userId
		});

		return json({ success: true, data: { team: createdTeam } });
	} catch (error) {
		console.error('Failed to manage club league team creation:', error);
		return json({ success: false, error: 'Unable to save club team right now.' }, { status: 500 });
	}
};
