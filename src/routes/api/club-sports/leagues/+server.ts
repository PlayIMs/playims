import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	createClubLeagueSchema,
	type CreateClubLeagueInput
} from '$lib/server/club-sports-validation';
import { normalizeClubSportsSlug, normalizeClubSportsText } from '$lib/server/club-sports-scope';
import type { RequestHandler } from './$types';

const toFieldErrorMap = (issues: Array<{ path: Array<PropertyKey>; message: string }>) => {
	const fieldErrors: Record<string, string[]> = {};
	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) fieldErrors[key] = [];
		fieldErrors[key].push(issue.message);
	}
	return fieldErrors;
};

const findDuplicateLeague = (
	leagues: Array<{ name?: string | null; slug?: string | null }>,
	input: { name: string; slug: string }
) =>
	leagues.find(
		(league) =>
			normalizeClubSportsText(league.name) === normalizeClubSportsText(input.name) ||
			normalizeClubSportsSlug(league.slug) === normalizeClubSportsSlug(input.slug)
	);

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{ success: false, error: 'Unable to save club league right now.' },
			{ status: 500 }
		);
	}
	if (!requirePermission(event.locals, PERMISSIONS.MANAGE_CLUB_SPORTS, { mutate: true })) {
		return json(
			{
				success: false,
				error: 'Only managers, administrators, and developers can manage club sports.'
			},
			{ status: 403 }
		);
	}

	const parsed = createClubLeagueSchema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			},
			{ status: 400 }
		);
	}

	const input: CreateClubLeagueInput = parsed.data;
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const club = await dbOps.clubSportsClubs.getByClientIdAndId(clientId, input.clubId);
		if (!club?.id) {
			return json({ success: false, error: 'Club not found.' }, { status: 404 });
		}

		const existingLeagues = await dbOps.clubSportsLeagues.getByClubId(club.id);
		for (const [index, league] of input.leagues.entries()) {
			if (!findDuplicateLeague(existingLeagues, league)) continue;
			return json(
				{
					success: false,
					error: 'A league with this name or slug already exists for the selected club sport.',
					fieldErrors: {
						[`leagues.${index}.name`]: [
							'A league with this name already exists for the selected club sport.'
						],
						[`leagues.${index}.slug`]: [
							'A league with this slug already exists for the selected club sport.'
						]
					}
				},
				{ status: 400 }
			);
		}

		const createdLeagueIds: string[] = [];
		for (const [index, league] of input.leagues.entries()) {
			const createdLeague = await dbOps.clubSportsLeagues.create({
				clientId,
				clubSeasonId: club.clubSeasonId,
				clubId: club.id,
				name: league.name,
				slug: normalizeClubSportsSlug(league.slug),
				stackOrder: league.stackOrder ?? index + 1,
				description: league.description,
				gender: league.gender,
				regStartDate: league.regStartDate,
				regEndDate: league.regEndDate,
				seasonStartDate: league.seasonStartDate,
				seasonEndDate: league.seasonEndDate,
				isActive: league.isActive ? 1 : 0,
				isLocked: league.isLocked ? 1 : 0,
				imageUrl: league.imageUrl,
				createdUser: userId,
				updatedUser: userId
			});
			if (createdLeague?.id) createdLeagueIds.push(createdLeague.id);
		}

		return json({ success: true, data: { leagueIds: createdLeagueIds } });
	} catch (error) {
		console.error('Failed to create club league:', error);
		return json(
			{ success: false, error: 'Unable to save club league right now.' },
			{ status: 500 }
		);
	}
};
