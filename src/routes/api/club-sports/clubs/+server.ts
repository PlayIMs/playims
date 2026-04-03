import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	createClubSchema,
	updateClubSchema,
	type CreateClubInput,
	type UpdateClubInput
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

const findDuplicateClub = (
	clubs: Array<{
		id?: string | null;
		clubSeasonId?: string | null;
		name?: string | null;
		slug?: string | null;
	}>,
	input: { clubSeasonId: string; name: string; slug: string },
	excludeClubId?: string
) =>
	clubs.find(
		(club) =>
			club.id !== excludeClubId &&
			club.clubSeasonId === input.clubSeasonId &&
			(normalizeClubSportsText(club.name) === normalizeClubSportsText(input.name) ||
				normalizeClubSportsSlug(club.slug) === normalizeClubSportsSlug(input.slug))
	);

const createOrUpdateForbiddenResponse = () =>
	json(
		{
			success: false,
			error: 'Only managers, administrators, and developers can manage club sports.'
		},
		{ status: 403 }
	);

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Unable to save club right now.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.MANAGE_CLUB_SPORTS, { mutate: true })) {
		return createOrUpdateForbiddenResponse();
	}

	const parsed = createClubSchema.safeParse(await event.request.json().catch(() => null));
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

	const input: CreateClubInput = parsed.data;
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const existingSeason = await dbOps.clubSportsSeasons.getByClientIdAndId(
			clientId,
			input.club.clubSeasonId
		);
		if (!existingSeason?.id) {
			return json(
				{
					success: false,
					error: 'The selected club season was not found.',
					fieldErrors: {
						'club.clubSeasonId': ['Select a valid club season.']
					}
				},
				{ status: 404 }
			);
		}

		const existingClubs = await dbOps.clubSportsClubs.getByClientId(clientId);
		if (findDuplicateClub(existingClubs, input.club)) {
			return json(
				{
					success: false,
					error: 'A club with this name or slug already exists for the selected club season.',
					fieldErrors: {
						'club.name': ['A club with this name already exists for the selected club season.'],
						'club.slug': ['A club with this slug already exists for the selected club season.']
					}
				},
				{ status: 400 }
			);
		}

		const createdClub = await dbOps.clubSportsClubs.create({
			clientId,
			clubSeasonId: input.club.clubSeasonId,
			name: input.club.name,
			slug: normalizeClubSportsSlug(input.club.slug),
			sport: input.club.sport,
			description: input.club.description,
			imageUrl: input.club.imageUrl,
			isActive: input.club.isActive ? 1 : 0,
			createdUser: userId,
			updatedUser: userId
		});

		const existingLeagues = createdClub?.id
			? await dbOps.clubSportsLeagues.getByClubId(createdClub.id)
			: [];
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
				clubSeasonId: input.club.clubSeasonId,
				clubId: createdClub?.id ?? '',
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

		return json({
			success: true,
			data: { clubId: createdClub?.id ?? '', leagueIds: createdLeagueIds }
		});
	} catch (error) {
		console.error('Failed to create club:', error);
		return json({ success: false, error: 'Unable to save club right now.' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Unable to save club right now.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.MANAGE_CLUB_SPORTS, { mutate: true })) {
		return createOrUpdateForbiddenResponse();
	}

	const parsed = updateClubSchema.safeParse(await event.request.json().catch(() => null));
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

	const input: UpdateClubInput = parsed.data;
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const existingClubs = await dbOps.clubSportsClubs.getByClientId(clientId);
		if (findDuplicateClub(existingClubs, input.club, input.clubId)) {
			return json(
				{
					success: false,
					error: 'A club with this name or slug already exists for the selected club season.',
					fieldErrors: {
						'club.name': ['A club with this name already exists for the selected club season.'],
						'club.slug': ['A club with this slug already exists for the selected club season.']
					}
				},
				{ status: 400 }
			);
		}

		const updatedClub = await dbOps.clubSportsClubs.updateByClientIdAndId(clientId, input.clubId, {
			clubSeasonId: input.club.clubSeasonId,
			name: input.club.name,
			slug: normalizeClubSportsSlug(input.club.slug),
			sport: input.club.sport,
			description: input.club.description,
			imageUrl: input.club.imageUrl,
			isActive: input.club.isActive ? 1 : 0,
			updatedUser: userId
		});

		return json({ success: true, data: { clubId: updatedClub?.id ?? input.clubId } });
	} catch (error) {
		console.error('Failed to update club:', error);
		return json({ success: false, error: 'Unable to save club right now.' }, { status: 500 });
	}
};
