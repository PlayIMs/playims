import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import {
	createIntramuralOfferingWithLeagueSchema,
	type CreateIntramuralOfferingWithLeagueInput,
	type CreatedIntramuralActivity
} from '$lib/server/intramural-offerings-validation';
import type { RequestHandler } from './$types';

const toActivityType = (value: string | null | undefined): 'league' | 'tournament' => {
	const normalized = value?.trim().toLowerCase();
	return normalized === 'tournament' ? 'tournament' : 'league';
};

const formatSeasonLabel = (season: string, year: number) => `${season} ${year}`;

const mapActivity = (input: {
	offeringId: string;
	leagueId: string;
	offeringName: string;
	offeringType: string | null | undefined;
	leagueName: string;
	season: string;
	year: number;
	gender: string;
	skillLevel: string;
	registrationStart: string;
	registrationEnd: string;
	seasonStart: string;
	seasonEnd: string;
	isLocked: boolean;
	isActive: boolean;
}): CreatedIntramuralActivity => ({
	id: input.leagueId,
	offeringId: input.offeringId,
	leagueId: input.leagueId,
	offeringType: toActivityType(input.offeringType),
	offeringName: input.offeringName,
	leagueName: input.leagueName,
	seasonLabel: formatSeasonLabel(input.season, input.year),
	season: input.season,
	year: input.year,
	gender: input.gender,
	skillLevel: input.skillLevel,
	registrationStart: input.registrationStart,
	registrationEnd: input.registrationEnd,
	seasonStart: input.seasonStart,
	seasonEnd: input.seasonEnd,
	divisionCount: 0,
	spotsRemaining: null,
	isLocked: input.isLocked,
	isActive: input.isActive
});

const toFieldErrorMap = (
	issues: Array<{ path: Array<PropertyKey>; message: string }>
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

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to save offering right now.'
			},
			{ status: 500 }
		);
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json(
			{
				success: false,
				error: 'Invalid request payload.'
			},
			{ status: 400 }
		);
	}

	const parsed = createIntramuralOfferingWithLeagueSchema.safeParse(body);
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

	const input: CreateIntramuralOfferingWithLeagueInput = parsed.data;
	const dbOps = new DatabaseOperations(event.platform as App.Platform);
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);

	try {
		const [existingOfferingSlug, existingLeagueSlug] = await Promise.all([
			dbOps.offerings.getByClientIdAndSlug(clientId, input.offering.slug),
			dbOps.leagues.getByClientIdAndSlug(clientId, input.league.slug)
		]);

		if (existingOfferingSlug || existingLeagueSlug) {
			const issues: Array<{ path: Array<string | number>; message: string }> = [];
			if (existingOfferingSlug) {
				issues.push({
					path: ['offering', 'slug'],
					message: 'An offering with this slug already exists.'
				});
			}
			if (existingLeagueSlug) {
				issues.push({
					path: ['league', 'slug'],
					message: 'A league with this slug already exists.'
				});
			}

			return json(
				{
					success: false,
					error: 'Duplicate slug detected.',
					fieldErrors: toFieldErrorMap(issues)
				},
				{ status: 409 }
			);
		}

		const createdOffering = await dbOps.offerings.create({
			clientId,
			name: input.offering.name,
			slug: input.offering.slug,
			isActive: input.offering.isActive ? 1 : 0,
			imageUrl: input.offering.imageUrl,
			minPlayers: input.offering.minPlayers,
			maxPlayers: input.offering.maxPlayers,
			rulebookUrl: input.offering.rulebookUrl,
			sport: input.offering.sport,
			type: input.offering.type,
			description: input.offering.description,
			createdUser: userId,
			updatedUser: userId
		});

		if (!createdOffering?.id) {
			return json(
				{
					success: false,
					error: 'Unable to save offering right now.'
				},
				{ status: 500 }
			);
		}

		const autoYear = new Date().getFullYear();
		const createdLeague = await dbOps.leagues.create({
			clientId,
			offeringId: createdOffering.id,
			name: input.league.name,
			slug: input.league.slug,
			description: input.league.description,
			year: autoYear,
			season: input.league.season,
			gender: input.league.gender,
			skillLevel: input.league.skillLevel,
			regStartDate: input.league.regStartDate,
			regEndDate: input.league.regEndDate,
			seasonStartDate: input.league.seasonStartDate,
			seasonEndDate: input.league.seasonEndDate,
			hasPostseason: input.league.hasPostseason ? 1 : 0,
			postseasonStartDate: input.league.hasPostseason ? input.league.postseasonStartDate : null,
			postseasonEndDate: input.league.hasPostseason ? input.league.postseasonEndDate : null,
			hasPreseason: input.league.hasPreseason ? 1 : 0,
			preseasonStartDate: input.league.hasPreseason ? input.league.preseasonStartDate : null,
			preseasonEndDate: input.league.hasPreseason ? input.league.preseasonEndDate : null,
			isActive: input.league.isActive ? 1 : 0,
			isLocked: input.league.isLocked ? 1 : 0,
			imageUrl: input.league.imageUrl,
			createdUser: userId,
			updatedUser: userId
		});

		if (!createdLeague?.id) {
			await dbOps.offerings.deleteById(createdOffering.id);
			return json(
				{
					success: false,
					error: 'Unable to save league right now.'
				},
				{ status: 500 }
			);
		}

		const activity = mapActivity({
			offeringId: createdOffering.id,
			leagueId: createdLeague.id,
			offeringName: createdOffering.name?.trim() || 'General Recreation',
			offeringType: createdOffering.type,
			leagueName: createdLeague.name?.trim() || 'Untitled League',
			season: createdLeague.season?.trim() || input.league.season,
			year: createdLeague.year ?? autoYear,
			gender: createdLeague.gender?.trim() || input.league.gender,
			skillLevel: createdLeague.skillLevel?.trim() || input.league.skillLevel,
			registrationStart: createdLeague.regStartDate ?? input.league.regStartDate,
			registrationEnd: createdLeague.regEndDate ?? input.league.regEndDate,
			seasonStart: createdLeague.seasonStartDate ?? input.league.seasonStartDate,
			seasonEnd: createdLeague.seasonEndDate ?? input.league.seasonEndDate,
			isLocked: createdLeague.isLocked === 1,
			isActive: createdLeague.isActive !== 0
		});

		return json(
			{
				success: true,
				data: {
					offeringId: createdOffering.id,
					leagueId: createdLeague.id,
					activity
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create intramural offering and league:', error);
		return json(
			{
				success: false,
				error: 'Unable to save offering right now.'
			},
			{ status: 500 }
		);
	}
};
