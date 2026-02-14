import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import {
	createIntramuralLeagueSchema,
	type CreateIntramuralLeagueInput,
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
	stackOrder: number | null;
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
	stackOrder: input.stackOrder,
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
				error: 'Unable to save entries right now.'
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

	const parsed = createIntramuralLeagueSchema.safeParse(body);
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

	const input: CreateIntramuralLeagueInput = parsed.data;
	const dbOps = new DatabaseOperations(event.platform as App.Platform);
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);

	try {
		const offerings = await dbOps.offerings.getByClientId(clientId);
		const selectedOffering =
			offerings.find((offering) => offering.id === input.offeringId && Boolean(offering.id)) ?? null;

		if (!selectedOffering?.id) {
			return json(
				{
					success: false,
					error: 'Select a valid offering before creating an entry.',
					fieldErrors: {
						offeringId: ['Offering is required.']
					}
				},
				{ status: 400 }
			);
		}
		const entryType = toActivityType(selectedOffering.type);
		const unitSingular = entryType === 'tournament' ? 'group' : 'league';
		const unitPlural = entryType === 'tournament' ? 'groups' : 'leagues';

		const existingLeaguesBySlug = await Promise.all(
			input.leagues.map((league, index) =>
				dbOps.leagues
					.getByClientIdAndSlug(clientId, league.slug)
					.then((existing) => ({ index, existing }))
			)
		);
		const duplicateSlugIssues: Array<{ path: Array<string | number>; message: string }> = [];
		for (const check of existingLeaguesBySlug) {
			if (!check.existing) continue;
			duplicateSlugIssues.push({
				path: ['leagues', check.index, 'slug'],
				message: `A ${unitSingular} with this slug already exists.`
			});
		}
		if (duplicateSlugIssues.length > 0) {
			return json(
				{
					success: false,
					error: 'Duplicate slug detected.',
					fieldErrors: toFieldErrorMap(duplicateSlugIssues)
				},
				{ status: 409 }
			);
		}

		const leagues = await dbOps.leagues.getByClientId(clientId);
		const nextStackOrderStart =
			leagues
				.filter((league) => league.offeringId === selectedOffering.id)
				.reduce((maxOrder, league) => {
					const stackOrder = league.stackOrder ?? 0;
					return stackOrder > maxOrder ? stackOrder : maxOrder;
				}, 0) + 1;

		const autoYear = new Date().getFullYear();
		const createdActivities: CreatedIntramuralActivity[] = [];
		const createdLeagueIds: string[] = [];
		for (const [index, leagueInput] of input.leagues.entries()) {
			const createdLeague = await dbOps.leagues.create({
				clientId,
				offeringId: selectedOffering.id,
				name: leagueInput.name,
				slug: leagueInput.slug,
				stackOrder: nextStackOrderStart + index,
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
				return json(
					{
						success: false,
						error: `Unable to save ${unitPlural} right now.`
					},
					{ status: 500 }
				);
			}

			createdLeagueIds.push(createdLeague.id);
			createdActivities.push(
				mapActivity({
					offeringId: selectedOffering.id,
					leagueId: createdLeague.id,
					stackOrder: createdLeague.stackOrder ?? nextStackOrderStart + index,
					offeringName: selectedOffering.name?.trim() || 'General Recreation',
					offeringType: selectedOffering.type,
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
					offeringId: selectedOffering.id,
					leagueIds: createdLeagueIds,
					activities: createdActivities
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create intramural league:', error);
		return json(
			{
				success: false,
				error: 'Unable to save entries right now.'
			},
			{ status: 500 }
		);
	}
};
