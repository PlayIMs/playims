import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	bulkUpdateIntramuralLeaguesSchema,
	type BulkUpdateIntramuralLeaguesInput,
	createIntramuralLeagueSchema,
	type CreateIntramuralLeagueInput,
	type CreatedIntramuralActivity,
	type UpdateIntramuralLeagueInput,
	updateIntramuralLeagueSchema
} from '$lib/server/intramural-offerings-validation';
import {
	normalizeIntramuralSlug,
	normalizeIntramuralText
} from '$lib/server/intramural-offering-scope';
import type { RequestHandler } from './$types';

const toActivityType = (value: string | null | undefined): 'league' | 'tournament' => {
	const normalized = value?.trim().toLowerCase();
	return normalized === 'tournament' ? 'tournament' : 'league';
};

const parseSeasonAndYear = (seasonName: string): { season: string | null; year: number | null } => {
	const match = seasonName.trim().match(/^(.+?)\s+(\d{4})$/);
	if (!match?.[1] || !match?.[2]) {
		return {
			season: seasonName.trim() || null,
			year: null
		};
	}

	const parsedYear = Number(match[2]);
	return {
		season: match[1].trim() || null,
		year: Number.isFinite(parsedYear) ? parsedYear : null
	};
};

const mapActivity = (input: {
	offeringId: string;
	offeringSlug: string | null;
	leagueId: string;
	leagueSlug: string | null;
	seasonId: string;
	stackOrder: number | null;
	offeringName: string;
	offeringType: string | null | undefined;
	leagueName: string;
	seasonLabel: string;
	gender: string | null;
	skillLevel: string | null;
	registrationStart: string;
	registrationEnd: string;
	seasonStart: string;
	seasonEnd: string;
	hasPostseason: boolean;
	postseasonStart: string | null;
	postseasonEnd: string | null;
	isLocked: boolean;
	isActive: boolean;
}): CreatedIntramuralActivity => ({
	id: input.leagueId,
	offeringId: input.offeringId,
	offeringSlug: input.offeringSlug,
	leagueId: input.leagueId,
	leagueSlug: input.leagueSlug,
	seasonId: input.seasonId,
	stackOrder: input.stackOrder,
	offeringType: toActivityType(input.offeringType),
	offeringName: input.offeringName,
	leagueName: input.leagueName,
	seasonLabel: input.seasonLabel,
	season: input.seasonLabel,
	year: null,
	gender: input.gender,
	skillLevel: input.skillLevel,
	registrationStart: input.registrationStart,
	registrationEnd: input.registrationEnd,
	seasonStart: input.seasonStart,
	seasonEnd: input.seasonEnd,
	hasPostseason: input.hasPostseason,
	postseasonStart: input.postseasonStart,
	postseasonEnd: input.postseasonEnd,
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

const trimOptional = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim() ?? '';
	return trimmed.length > 0 ? trimmed : null;
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
	const clientId = requireAuthenticatedClientId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);
	const userId = requireAuthenticatedUserId(event.locals);

	try {
		const offerings = await dbOps.offerings.getByClientId(clientId);
		const seasons = await dbOps.seasons.getByClientId(clientId);
		const seasonById = new Map(seasons.map((season) => [season.id, season]));
		const selectedOffering =
			offerings.find((offering) => offering.id === input.offeringId && Boolean(offering.id)) ??
			null;

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
		const selectedOfferingSeasonId = selectedOffering.seasonId?.trim() ?? '';
		if (!selectedOfferingSeasonId) {
			return json(
				{
					success: false,
					error: 'Selected offering is missing a season assignment.',
					fieldErrors: {
						offeringId: ['Offering must be linked to a season before adding entries.']
					}
				},
				{ status: 400 }
			);
		}

		const existingOfferingLeagues = await dbOps.leagues.getByOfferingId(selectedOffering.id);
		const duplicateIssues: Array<{ path: Array<string | number>; message: string }> = [];
		for (const [index, league] of input.leagues.entries()) {
			const duplicateSlug = existingOfferingLeagues.find(
				(existingLeague) =>
					normalizeIntramuralSlug(existingLeague.slug) === normalizeIntramuralSlug(league.slug)
			);
			if (duplicateSlug) {
				duplicateIssues.push({
					path: ['leagues', index, 'slug'],
					message: `A ${unitSingular} with this slug already exists for the selected offering.`
				});
			}

			const duplicateName = existingOfferingLeagues.find(
				(existingLeague) =>
					normalizeIntramuralText(existingLeague.name) === normalizeIntramuralText(league.name)
			);
			if (duplicateName) {
				duplicateIssues.push({
					path: ['leagues', index, 'name'],
					message: `A ${unitSingular} with this name already exists for the selected offering.`
				});
			}
		}
		if (duplicateIssues.length > 0) {
			return json(
				{
					success: false,
					error: 'Duplicate slug detected.',
					fieldErrors: toFieldErrorMap(duplicateIssues)
				},
				{ status: 409 }
			);
		}
		const invalidSeasonIssues: Array<{ path: Array<string | number>; message: string }> = [];
		for (const [index, league] of input.leagues.entries()) {
			const season = seasonById.get(league.seasonId);
			if (!season) {
				invalidSeasonIssues.push({
					path: ['leagues', index, 'seasonId'],
					message: 'Select a valid season.'
				});
				continue;
			}
			if (league.seasonId !== selectedOfferingSeasonId) {
				invalidSeasonIssues.push({
					path: ['leagues', index, 'seasonId'],
					message: 'League/group season must match the selected offering season.'
				});
			}
		}
		if (invalidSeasonIssues.length > 0) {
			return json(
				{
					success: false,
					error: 'Invalid season selected.',
					fieldErrors: toFieldErrorMap(invalidSeasonIssues)
				},
				{ status: 400 }
			);
		}

		const nextStackOrderStart =
			existingOfferingLeagues
				.reduce((maxOrder, league) => {
					const stackOrder = league.stackOrder ?? 0;
					return stackOrder > maxOrder ? stackOrder : maxOrder;
				}, 0) + 1;

		const createdActivities: CreatedIntramuralActivity[] = [];
		const createdLeagueIds: string[] = [];
		for (const [index, leagueInput] of input.leagues.entries()) {
			const selectedSeason = seasonById.get(leagueInput.seasonId);
			if (!selectedSeason?.id) {
				throw new Error('Invalid season selected for league create.');
			}
			const seasonLabel = selectedSeason.name?.trim() || 'Unscheduled';
			const parsedSeason = parseSeasonAndYear(seasonLabel);
			const createdLeague = await dbOps.leagues.create({
				clientId,
				offeringId: selectedOffering.id,
				seasonId: selectedSeason.id,
				name: leagueInput.name,
				slug: leagueInput.slug,
				stackOrder: nextStackOrderStart + index,
				description: leagueInput.description,
				year: parsedSeason.year,
				season: parsedSeason.season,
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
					offeringSlug: selectedOffering.slug?.trim() || null,
					leagueId: createdLeague.id,
					leagueSlug: createdLeague.slug?.trim() || leagueInput.slug,
					seasonId: selectedSeason.id,
					stackOrder: createdLeague.stackOrder ?? nextStackOrderStart + index,
					offeringName: selectedOffering.name?.trim() || 'General Recreation',
					offeringType: selectedOffering.type,
					leagueName: createdLeague.name?.trim() || 'Untitled League',
					seasonLabel,
					gender: createdLeague.gender?.trim() || leagueInput.gender,
					skillLevel: createdLeague.skillLevel?.trim() || leagueInput.skillLevel,
					registrationStart: createdLeague.regStartDate ?? leagueInput.regStartDate,
					registrationEnd: createdLeague.regEndDate ?? leagueInput.regEndDate,
					seasonStart: createdLeague.seasonStartDate ?? leagueInput.seasonStartDate,
					seasonEnd: createdLeague.seasonEndDate ?? leagueInput.seasonEndDate,
					hasPostseason: (createdLeague.hasPostseason ?? 0) === 1,
					postseasonStart:
						createdLeague.postseasonStartDate ??
						(leagueInput.hasPostseason ? leagueInput.postseasonStartDate : null),
					postseasonEnd:
						createdLeague.postseasonEndDate ??
						(leagueInput.hasPostseason ? leagueInput.postseasonEndDate : null),
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

export const PATCH: RequestHandler = async (event) => {
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

	if (
		typeof body === 'object' &&
		body !== null &&
		'action' in body &&
		(body as { action?: unknown }).action === 'bulk-update'
	) {
		const parsedBulk = bulkUpdateIntramuralLeaguesSchema.safeParse(body);
		if (!parsedBulk.success) {
			return json(
				{
					success: false,
					error: 'Invalid request payload.',
					fieldErrors: toFieldErrorMap(parsedBulk.error.issues)
				},
				{ status: 400 }
			);
		}

		const input: BulkUpdateIntramuralLeaguesInput = parsedBulk.data;
		const clientId = requireAuthenticatedClientId(event.locals);
		const dbOps = await getTenantDbOps(event, clientId);
		const userId = requireAuthenticatedUserId(event.locals);

		try {
			const offerings = await dbOps.offerings.getByClientId(clientId);
			const seasons = await dbOps.seasons.getByClientId(clientId);
			const seasonById = new Map(seasons.map((season) => [season.id, season]));
			const selectedOffering =
				offerings.find((offering) => offering.id === input.offeringId && Boolean(offering.id)) ??
				null;

			if (!selectedOffering?.id) {
				return json(
					{
						success: false,
						error: 'Select a valid offering before saving these entries.',
						fieldErrors: {
							offeringId: ['Offering is required.']
						}
					},
					{ status: 400 }
				);
			}

			const existingOfferingLeagues = await dbOps.leagues.getByOfferingId(selectedOffering.id);
			const leaguesById = new Map(
				existingOfferingLeagues
					.filter((league): league is typeof existingOfferingLeagues[number] & { id: string } =>
						Boolean(league.id)
					)
					.map((league) => [league.id, league] as const)
			);
			const selectedLeagues = input.leagueIds
				.map((leagueId) => leaguesById.get(leagueId))
				.filter((league): league is NonNullable<typeof league> => Boolean(league));

			if (selectedLeagues.length !== input.leagueIds.length) {
				return json(
					{
						success: false,
						error: 'Some selected leagues could not be found.',
						fieldErrors: {
							leagueIds: ['One or more selected leagues are no longer available.']
						}
					},
					{ status: 404 }
				);
			}

			if (
				input.changes.postseasonStartDate ||
				input.changes.postseasonEndDate
			) {
				if (input.changes.hasPostseason === false) {
					return json(
						{
							success: false,
							error: 'Invalid postseason settings.',
							fieldErrors: {
								'changes.hasPostseason': [
									'Postseason dates cannot be set while postseason is being disabled.'
								]
							}
						},
						{ status: 400 }
					);
				}
				if (
					input.changes.hasPostseason === undefined &&
					selectedLeagues.some((league) => (league.hasPostseason ?? 0) !== 1)
				) {
					return json(
						{
							success: false,
							error: 'Invalid postseason settings.',
							fieldErrors: {
								'changes.hasPostseason': [
									'Set postseason to enabled before bulk editing postseason dates for leagues that do not already use postseason.'
								]
							}
						},
						{ status: 400 }
					);
				}
			}

			if (
				input.changes.preseasonStartDate ||
				input.changes.preseasonEndDate
			) {
				if (input.changes.hasPreseason === false) {
					return json(
						{
							success: false,
							error: 'Invalid preseason settings.',
							fieldErrors: {
								'changes.hasPreseason': [
									'Preseason dates cannot be set while preseason is being disabled.'
								]
							}
						},
						{ status: 400 }
					);
				}
				if (
					input.changes.hasPreseason === undefined &&
					selectedLeagues.some((league) => (league.hasPreseason ?? 0) !== 1)
				) {
					return json(
						{
							success: false,
							error: 'Invalid preseason settings.',
							fieldErrors: {
								'changes.hasPreseason': [
									'Set preseason to enabled before bulk editing preseason dates for leagues that do not already use preseason.'
								]
							}
						},
						{ status: 400 }
					);
				}
			}

			const validationIssues: Array<{ path: Array<PropertyKey>; message: string }> = [];
			const mergedLeagues = selectedLeagues.map((league) => {
				const seasonId = league.seasonId?.trim() || selectedOffering.seasonId?.trim() || '';
				const mergedLeague = {
					name: league.name?.trim() || 'Untitled League',
					slug: league.slug?.trim() || '',
					stackOrder: league.stackOrder ?? 1,
					description:
						input.changes.description !== undefined
							? input.changes.description
							: trimOptional(league.description),
					seasonId,
					gender:
						input.changes.gender !== undefined
							? input.changes.gender
							: ((league.gender?.trim() ?? null) as 'male' | 'female' | 'mixed' | null),
					skillLevel:
						input.changes.skillLevel !== undefined
							? input.changes.skillLevel
							: ((league.skillLevel?.trim() ?? null) as
									| 'competitive'
									| 'intermediate'
									| 'recreational'
									| 'all'
									| null),
					regStartDate: input.changes.regStartDate ?? league.regStartDate ?? '',
					regEndDate: input.changes.regEndDate ?? league.regEndDate ?? '',
					seasonStartDate: input.changes.seasonStartDate ?? league.seasonStartDate ?? '',
					seasonEndDate: input.changes.seasonEndDate ?? league.seasonEndDate ?? '',
					hasPostseason:
						input.changes.hasPostseason !== undefined
							? input.changes.hasPostseason
							: (league.hasPostseason ?? 0) === 1,
					postseasonStartDate:
						input.changes.hasPostseason === false
							? null
							: input.changes.postseasonStartDate ??
								trimOptional(league.postseasonStartDate),
					postseasonEndDate:
						input.changes.hasPostseason === false
							? null
							: input.changes.postseasonEndDate ?? trimOptional(league.postseasonEndDate),
					hasPreseason:
						input.changes.hasPreseason !== undefined
							? input.changes.hasPreseason
							: (league.hasPreseason ?? 0) === 1,
					preseasonStartDate:
						input.changes.hasPreseason === false
							? null
							: input.changes.preseasonStartDate ?? trimOptional(league.preseasonStartDate),
					preseasonEndDate:
						input.changes.hasPreseason === false
							? null
							: input.changes.preseasonEndDate ?? trimOptional(league.preseasonEndDate),
					isActive:
						input.changes.isActive !== undefined
							? input.changes.isActive
							: (league.isActive ?? 0) !== 0,
					isLocked:
						input.changes.isLocked !== undefined
							? input.changes.isLocked
							: (league.isLocked ?? 0) === 1,
					imageUrl:
						input.changes.imageUrl !== undefined
							? input.changes.imageUrl
							: trimOptional(league.imageUrl)
				};

				const validationResult = updateIntramuralLeagueSchema.safeParse({
					leagueId: league.id,
					offeringId: selectedOffering.id,
					league: mergedLeague
				});
				if (!validationResult.success) {
					const firstIssue = validationResult.error.issues[0];
					validationIssues.push({
						path: ['changes', firstIssue?.path?.[1] ?? 'changes'],
						message: `${league.name?.trim() || 'League'}: ${firstIssue?.message ?? 'Invalid league update.'}`
					});
					return null;
				}

				return {
					existing: league,
					league: validationResult.data.league
				};
			});

			if (validationIssues.length > 0 || mergedLeagues.some((league) => league === null)) {
				return json(
					{
						success: false,
						error: 'One or more selected leagues could not be updated with those changes.',
						fieldErrors: toFieldErrorMap(validationIssues)
					},
					{ status: 400 }
				);
			}

			const updatedLeagueIds: string[] = [];
			for (const mergedLeague of mergedLeagues) {
				if (!mergedLeague) continue;

				const selectedSeason = seasonById.get(mergedLeague.league.seasonId);
				if (!selectedSeason?.id) {
					return json(
						{
							success: false,
							error: 'Invalid season selected.',
							fieldErrors: {
								'changes.seasonStartDate': ['A selected league is missing a valid season.']
							}
						},
						{ status: 400 }
					);
				}

				const seasonLabel = selectedSeason.name?.trim() || 'Unscheduled';
				const parsedSeason = parseSeasonAndYear(seasonLabel);
				const updatedLeague = await dbOps.leagues.updateByClientIdAndId(
					clientId,
					mergedLeague.existing.id,
					{
						offeringId: selectedOffering.id,
						seasonId: selectedSeason.id,
						name: mergedLeague.league.name,
						slug: mergedLeague.league.slug,
						stackOrder: mergedLeague.league.stackOrder,
						description: mergedLeague.league.description,
						year: parsedSeason.year,
						season: parsedSeason.season,
						gender: mergedLeague.league.gender,
						skillLevel: mergedLeague.league.skillLevel,
						regStartDate: mergedLeague.league.regStartDate,
						regEndDate: mergedLeague.league.regEndDate,
						seasonStartDate: mergedLeague.league.seasonStartDate,
						seasonEndDate: mergedLeague.league.seasonEndDate,
						hasPostseason: mergedLeague.league.hasPostseason ? 1 : 0,
						postseasonStartDate: mergedLeague.league.hasPostseason
							? mergedLeague.league.postseasonStartDate
							: null,
						postseasonEndDate: mergedLeague.league.hasPostseason
							? mergedLeague.league.postseasonEndDate
							: null,
						hasPreseason: mergedLeague.league.hasPreseason ? 1 : 0,
						preseasonStartDate: mergedLeague.league.hasPreseason
							? mergedLeague.league.preseasonStartDate
							: null,
						preseasonEndDate: mergedLeague.league.hasPreseason
							? mergedLeague.league.preseasonEndDate
							: null,
						isActive: mergedLeague.league.isActive ? 1 : 0,
						isLocked: mergedLeague.league.isLocked ? 1 : 0,
						imageUrl: mergedLeague.league.imageUrl,
						updatedUser: userId
					}
				);

				if (!updatedLeague?.id) {
					return json(
						{
							success: false,
							error: 'Unable to update leagues right now.'
						},
						{ status: 500 }
					);
				}

				updatedLeagueIds.push(updatedLeague.id);
			}

			return json(
				{
					success: true,
					data: {
						leagueIds: updatedLeagueIds
					}
				},
				{ status: 200 }
			);
		} catch (error) {
			console.error('Failed to bulk update intramural leagues:', error);
			return json(
				{
					success: false,
					error: 'Unable to save entries right now.'
				},
				{ status: 500 }
			);
		}
	}

	const parsed = updateIntramuralLeagueSchema.safeParse(body);
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

	const input: UpdateIntramuralLeagueInput = parsed.data;
	const clientId = requireAuthenticatedClientId(event.locals);
	const dbOps = await getTenantDbOps(event, clientId);
	const userId = requireAuthenticatedUserId(event.locals);

	try {
		const offerings = await dbOps.offerings.getByClientId(clientId);
		const seasons = await dbOps.seasons.getByClientId(clientId);
		const seasonById = new Map(seasons.map((season) => [season.id, season]));
		const selectedOffering =
			offerings.find((offering) => offering.id === input.offeringId && Boolean(offering.id)) ?? null;

		if (!selectedOffering?.id) {
			return json(
				{
					success: false,
					error: 'Select a valid offering before saving this entry.',
					fieldErrors: {
						offeringId: ['Offering is required.']
					}
				},
				{ status: 400 }
			);
		}

		const existingLeague = await dbOps.leagues.getByClientIdAndId(clientId, input.leagueId);
		if (!existingLeague?.id) {
			return json(
				{
					success: false,
					error: 'This league could not be found.'
				},
				{ status: 404 }
			);
		}

		const entryType = toActivityType(selectedOffering.type);
		const unitSingular = entryType === 'tournament' ? 'group' : 'league';
		const selectedOfferingSeasonId = selectedOffering.seasonId?.trim() ?? '';
		if (!selectedOfferingSeasonId) {
			return json(
				{
					success: false,
					error: 'Selected offering is missing a season assignment.',
					fieldErrors: {
						offeringId: ['Offering must be linked to a season before updating entries.']
					}
				},
				{ status: 400 }
			);
		}

		const existingOfferingLeagues = await dbOps.leagues.getByOfferingId(selectedOffering.id);
		const duplicateIssues: Array<{ path: Array<string | number>; message: string }> = [];
		const duplicateSlug = existingOfferingLeagues.find(
			(league) =>
				league.id !== existingLeague.id &&
				normalizeIntramuralSlug(league.slug) === normalizeIntramuralSlug(input.league.slug)
		);
		if (duplicateSlug) {
			duplicateIssues.push({
				path: ['league', 'slug'],
				message: `A ${unitSingular} with this slug already exists for the selected offering.`
			});
		}

		const duplicateName = existingOfferingLeagues.find(
			(league) =>
				league.id !== existingLeague.id &&
				normalizeIntramuralText(league.name) === normalizeIntramuralText(input.league.name)
		);
		if (duplicateName) {
			duplicateIssues.push({
				path: ['league', 'name'],
				message: `A ${unitSingular} with this name already exists for the selected offering.`
			});
		}

		if (duplicateIssues.length > 0) {
			return json(
				{
					success: false,
					error: 'Duplicate name or slug detected.',
					fieldErrors: toFieldErrorMap(duplicateIssues)
				},
				{ status: 409 }
			);
		}

		const selectedSeason = seasonById.get(input.league.seasonId);
		if (!selectedSeason) {
			return json(
				{
					success: false,
					error: 'Invalid season selected.',
					fieldErrors: {
						'league.seasonId': ['Select a valid season.']
					}
				},
				{ status: 400 }
			);
		}

		if (input.league.seasonId !== selectedOfferingSeasonId) {
			return json(
				{
					success: false,
					error: 'Invalid season selected.',
					fieldErrors: {
						'league.seasonId': ['League/group season must match the selected offering season.']
					}
				},
				{ status: 400 }
			);
		}

		const seasonLabel = selectedSeason.name?.trim() || 'Unscheduled';
		const parsedSeason = parseSeasonAndYear(seasonLabel);
		const updatedLeague = await dbOps.leagues.updateByClientIdAndId(clientId, existingLeague.id, {
			offeringId: selectedOffering.id,
			seasonId: selectedSeason.id,
			name: input.league.name,
			slug: input.league.slug,
			stackOrder: input.league.stackOrder,
			description: input.league.description,
			year: parsedSeason.year,
			season: parsedSeason.season,
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
			updatedUser: userId
		});

		if (!updatedLeague?.id) {
			return json(
				{
					success: false,
					error: `Unable to update ${unitSingular} right now.`
				},
				{ status: 500 }
			);
		}

		return json(
			{
				success: true,
				data: {
					leagueId: updatedLeague.id
				}
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error('Failed to update intramural league:', error);
		return json(
			{
				success: false,
				error: 'Unable to save entries right now.'
			},
			{ status: 500 }
		);
	}
};
