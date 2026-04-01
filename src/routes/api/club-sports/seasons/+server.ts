import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId, requireAuthenticatedUserId } from '$lib/server/client-context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	createClubSeasonSchema,
	type CreateClubSeasonInput
} from '$lib/server/club-sports-validation';
import {
	normalizeClubSportsSlug,
	normalizeClubSportsText
} from '$lib/server/club-sports-scope';
import type { RequestHandler } from './$types';

const DEFAULT_COPY_SELECTION = {
	includeClubs: true,
	includeLeagues: true,
	includeTeams: true,
	includeOfficers: false,
	includeRosters: false,
	includeSchedules: false
};

const toFieldErrorMap = (issues: Array<{ path: Array<PropertyKey>; message: string }>) => {
	const fieldErrors: Record<string, string[]> = {};
	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) fieldErrors[key] = [];
		fieldErrors[key].push(issue.message);
	}
	return fieldErrors;
};

export const GET: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Unable to load club seasons right now.' }, { status: 500 });
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);
	try {
		const seasons = await dbOps.clubSportsSeasons.getByClientId(clientId);
		return json({
			success: true,
			data: {
				currentSeasonId: seasons.find((season) => season.isCurrent === 1)?.id ?? null,
				seasons: seasons.map((season) => ({
					id: season.id,
					name: season.name,
					slug: season.slug,
					startDate: season.startDate,
					endDate: season.endDate,
					isCurrent: season.isCurrent === 1,
					isActive: season.isActive === 1
				}))
			}
		});
	} catch (error) {
		console.error('Failed to load club seasons:', error);
		return json({ success: false, error: 'Unable to load club seasons right now.' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Unable to save club season right now.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.MANAGE_CLUB_SPORTS, { mutate: true })) {
		return json(
			{ success: false, error: 'Only managers, administrators, and developers can manage club sports.' },
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const parsed = createClubSeasonSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ success: false, error: 'Invalid request payload.', fieldErrors: toFieldErrorMap(parsed.error.issues) },
			{ status: 400 }
		);
	}

	const input: CreateClubSeasonInput = parsed.data;
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const seasons = await dbOps.clubSportsSeasons.getByClientId(clientId);
		const duplicateSeason = seasons.find(
			(season) =>
				normalizeClubSportsText(season.name) === normalizeClubSportsText(input.season.name) ||
				normalizeClubSportsSlug(season.slug) === normalizeClubSportsSlug(input.season.slug)
		);
		if (duplicateSeason) {
			return json(
				{
					success: false,
					error: 'A club season with this name or slug already exists.',
					fieldErrors: {
						'season.name': ['A club season with this name already exists.'],
						'season.slug': ['A club season with this slug already exists.']
					}
				},
				{ status: 400 }
			);
		}

		const createdSeason = await dbOps.clubSportsSeasons.create({
			clientId,
			name: input.season.name,
			slug: normalizeClubSportsSlug(input.season.slug),
			startDate: input.season.startDate,
			endDate: input.season.endDate,
			isCurrent: input.season.isCurrent ? 1 : 0,
			isActive: input.season.isActive ? 1 : 0,
			createdUser: userId,
			updatedUser: userId
		});

		if (createdSeason?.id && input.season.isCurrent) {
			await dbOps.clubSportsSeasons.setCurrent(clientId, createdSeason.id);
		}

		return json({
			success: true,
			data: {
				season: createdSeason,
				copy: {
					enabled: input.copy.enabled,
					sourceSeasonIds: input.copy.sourceSeasonIds,
					selection: {
						includeClubs: input.copy.enabled ? input.copy.includeClubs : DEFAULT_COPY_SELECTION.includeClubs,
						includeLeagues: input.copy.enabled ? input.copy.includeLeagues : DEFAULT_COPY_SELECTION.includeLeagues,
						includeTeams: input.copy.enabled ? input.copy.includeTeams : DEFAULT_COPY_SELECTION.includeTeams,
						includeOfficers: input.copy.enabled ? input.copy.includeOfficers : DEFAULT_COPY_SELECTION.includeOfficers,
						includeRosters: input.copy.enabled ? input.copy.includeRosters : DEFAULT_COPY_SELECTION.includeRosters,
						includeSchedules: input.copy.enabled ? input.copy.includeSchedules : DEFAULT_COPY_SELECTION.includeSchedules
					}
				}
			}
		});
	} catch (error) {
		console.error('Failed to create club season:', error);
		return json({ success: false, error: 'Unable to save club season right now.' }, { status: 500 });
	}
};
