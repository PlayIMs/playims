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
	gender: string | null;
	skillLevel: string | null;
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

	let createdOfferingId: string | null = null;

	try {
		const issues: Array<{ path: Array<string | number>; message: string }> = [];
		const existingOfferingSlug = await dbOps.offerings.getByClientIdAndSlug(
			clientId,
			input.offering.slug
		);
		if (existingOfferingSlug) {
			issues.push({
				path: ['offering', 'slug'],
				message: 'An offering with this slug already exists.'
			});
		}

		if (input.leagues.length > 0) {
			const existingLeaguesBySlug = await Promise.all(
				input.leagues.map((league, index) =>
					dbOps.leagues
						.getByClientIdAndSlug(clientId, league.slug)
						.then((existing) => ({ index, existing }))
				)
			);

			for (const check of existingLeaguesBySlug) {
				if (!check.existing) continue;
				issues.push({
					path: ['leagues', check.index, 'slug'],
					message: 'A league with this slug already exists.'
				});
			}
		}

		if (issues.length > 0) {
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

		createdOfferingId = createdOffering.id;
		const autoYear = new Date().getFullYear();
		const createdActivities: CreatedIntramuralActivity[] = [];
		const createdLeagueIds: string[] = [];

		for (const leagueInput of input.leagues) {
			const createdLeague = await dbOps.leagues.create({
				clientId,
				offeringId: createdOffering.id,
				name: leagueInput.name,
				slug: leagueInput.slug,
				description: leagueInput.description,
				year: autoYear,
				season: leagueInput.season,
				gender: leagueInput.gender,
				skillLevel: leagueInput.skillLevel,
				regStartDate: leagueInput.regStartDate,
				regEndDate: leagueInput.regEndDate,
				seasonStartDate: leagueInput.seasonStartDate,
				seasonEndDate: leagueInput.seasonEndDate,
				hasPostseason: leagueInput.hasPostseason ? 1 : 0,
				postseasonStartDate: leagueInput.hasPostseason ? leagueInput.postseasonStartDate : null,
				postseasonEndDate: leagueInput.hasPostseason ? leagueInput.postseasonEndDate : null,
				hasPreseason: leagueInput.hasPreseason ? 1 : 0,
				preseasonStartDate: leagueInput.hasPreseason ? leagueInput.preseasonStartDate : null,
				preseasonEndDate: leagueInput.hasPreseason ? leagueInput.preseasonEndDate : null,
				isActive: leagueInput.isActive ? 1 : 0,
				isLocked: leagueInput.isLocked ? 1 : 0,
				imageUrl: leagueInput.imageUrl,
				createdUser: userId,
				updatedUser: userId
			});

			if (!createdLeague?.id) {
				throw new Error('Unable to save league right now.');
			}

			createdLeagueIds.push(createdLeague.id);
			createdActivities.push(
				mapActivity({
					offeringId: createdOffering.id,
					leagueId: createdLeague.id,
					offeringName: createdOffering.name?.trim() || 'General Recreation',
					offeringType: createdOffering.type,
					leagueName: createdLeague.name?.trim() || 'Untitled League',
					season: createdLeague.season?.trim() || leagueInput.season,
					year: createdLeague.year ?? autoYear,
					gender: createdLeague.gender?.trim() || leagueInput.gender,
					skillLevel: createdLeague.skillLevel?.trim() || leagueInput.skillLevel,
					registrationStart: createdLeague.regStartDate ?? leagueInput.regStartDate,
					registrationEnd: createdLeague.regEndDate ?? leagueInput.regEndDate,
					seasonStart: createdLeague.seasonStartDate ?? leagueInput.seasonStartDate,
					seasonEnd: createdLeague.seasonEndDate ?? leagueInput.seasonEndDate,
					isLocked: createdLeague.isLocked === 1,
					isActive: createdLeague.isActive !== 0
				})
			);
		}

		return json(
			{
				success: true,
				data: {
					offeringId: createdOffering.id,
					leagueIds: createdLeagueIds,
					activities: createdActivities
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		if (createdOfferingId) {
			try {
				await dbOps.leagues.deleteByOfferingId(createdOfferingId);
				await dbOps.offerings.deleteById(createdOfferingId);
			} catch (cleanupError) {
				console.error('Failed to rollback intramural offering create:', cleanupError);
			}
		}

		console.error('Failed to create intramural offering and leagues:', error);
		return json(
			{
				success: false,
				error: 'Unable to save offering right now.'
			},
			{ status: 500 }
		);
	}
};
