import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import {
	createIntramuralSeasonSchema,
	type CreateIntramuralSeasonInput,
	type CreateIntramuralSeasonResponse
} from '$lib/server/intramural-offerings-validation';
import type { RequestHandler } from './$types';

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

function normalizeText(value: string | null | undefined): string {
	return value?.trim().toLowerCase() ?? '';
}

function normalizeSlug(value: string | null | undefined): string {
	if (!value) return '';
	return value
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function parseSeasonAndYear(seasonName: string): { season: string | null; year: number | null } {
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
}

function buildUniqueSlug(base: string, usedSlugs: Set<string>): string {
	const normalizedBase = normalizeSlug(base) || 'copy';
	let candidate = normalizedBase;
	let suffix = 2;

	while (usedSlugs.has(candidate)) {
		candidate = `${normalizedBase}-${suffix}`;
		suffix += 1;
	}

	usedSlugs.add(candidate);
	return candidate;
}

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to save season right now.'
			} satisfies CreateIntramuralSeasonResponse,
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
			} satisfies CreateIntramuralSeasonResponse,
			{ status: 400 }
		);
	}

	const parsed = createIntramuralSeasonSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies CreateIntramuralSeasonResponse,
			{ status: 400 }
		);
	}

	const input: CreateIntramuralSeasonInput = parsed.data;
	const dbOps = new DatabaseOperations(event.platform as App.Platform);
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);

	try {
		const existingSeasons = await dbOps.seasons.getByClientId(clientId);
		const existingCurrentSeason = existingSeasons.find((season) => season.isCurrent === 1) ?? null;
		const sourceSeasonId = input.copyOptions?.sourceSeasonId?.trim() ?? '';
		const duplicateSlug = existingSeasons.find(
			(season) => normalizeText(season.slug) === normalizeText(input.season.slug)
		);
		const duplicateName = existingSeasons.find(
			(season) => normalizeText(season.name) === normalizeText(input.season.name)
		);
		const duplicateIssues: Array<{ path: Array<string>; message: string }> = [];
		const validationIssues: Array<{ path: Array<string>; message: string }> = [];

		if (duplicateSlug) {
			duplicateIssues.push({
				path: ['season', 'slug'],
				message: 'A season with this slug already exists.'
			});
		}

		if (duplicateName) {
			duplicateIssues.push({
				path: ['season', 'name'],
				message: 'A season with this name already exists.'
			});
		}

		if (duplicateIssues.length > 0) {
			return json(
				{
					success: false,
					error: 'Duplicate season detected.',
					fieldErrors: toFieldErrorMap(duplicateIssues)
				} satisfies CreateIntramuralSeasonResponse,
				{ status: 409 }
			);
		}

		if (input.copyOptions) {
			if (!sourceSeasonId) {
				validationIssues.push({
					path: ['copyOptions', 'sourceSeasonId'],
					message: 'Select a season to copy from.'
				});
			} else if (!existingSeasons.some((season) => season.id === sourceSeasonId)) {
				validationIssues.push({
					path: ['copyOptions', 'sourceSeasonId'],
					message: 'Select a valid source season.'
				});
			}
		}

		if (validationIssues.length > 0) {
			return json(
				{
					success: false,
					error: 'Invalid request payload.',
					fieldErrors: toFieldErrorMap(validationIssues)
				} satisfies CreateIntramuralSeasonResponse,
				{ status: 400 }
			);
		}

		const clearExistingCurrent = input.currentSeasonTransition?.clearExistingCurrent ?? true;
		const shouldBeCurrent =
			existingSeasons.length === 0 || (input.season.isCurrent && (!existingCurrentSeason || clearExistingCurrent));
		const createdSeason = await dbOps.seasons.create({
			clientId,
			name: input.season.name,
			slug: input.season.slug,
			startDate: input.season.startDate,
			endDate: input.season.endDate,
			isCurrent: shouldBeCurrent ? 1 : 0,
			isActive: input.season.isActive ? 1 : 0,
			createdUser: userId,
			updatedUser: userId
		});

		if (!createdSeason?.id) {
			return json(
				{
					success: false,
					error: 'Unable to save season right now.'
				} satisfies CreateIntramuralSeasonResponse,
				{ status: 500 }
			);
		}

		if (shouldBeCurrent) {
			await dbOps.seasons.setCurrent(clientId, createdSeason.id, userId);
		}

		const shouldDeactivateExistingCurrent =
			Boolean(input.currentSeasonTransition?.deactivateExistingCurrent) &&
			shouldBeCurrent &&
			Boolean(existingCurrentSeason?.id) &&
			existingCurrentSeason?.id !== createdSeason.id;

		if (shouldDeactivateExistingCurrent && existingCurrentSeason?.id) {
			await dbOps.seasons.setActive(clientId, existingCurrentSeason.id, false, userId);
		}

		let copySummary:
			| {
					offeringCount: number;
					leagueCount: number;
					divisionCount: number;
			  }
			| undefined;

		if (input.copyOptions && sourceSeasonId) {
			const [existingOfferings, allLeagues] = await Promise.all([
				dbOps.offerings.getByClientId(clientId),
				dbOps.leagues.getByClientId(clientId)
			]);
			const sourceSeasonLeagues = allLeagues.filter((league) => league.seasonId === sourceSeasonId);
			const offeringById = new Map(
				existingOfferings
					.filter((offering) => Boolean(offering.id))
					.map((offering) => [offering.id as string, offering] as const)
			);
			const sourceSeasonActivities = sourceSeasonLeagues.filter(
				(league) => league.offeringId && offeringById.has(league.offeringId)
			);
			const scope = input.copyOptions.scope;
			const scopedActivities =
				scope === 'offerings-leagues'
					? sourceSeasonActivities.filter((league) => {
							const offering = league.offeringId ? offeringById.get(league.offeringId) : null;
							return normalizeText(offering?.type) !== 'tournament';
						})
					: sourceSeasonActivities;

			const offeringIdsForCopy =
				scope === 'offerings-leagues'
					? new Set(
							scopedActivities
								.map((league) => league.offeringId)
								.filter((offeringId): offeringId is string => Boolean(offeringId))
						)
					: new Set(
							sourceSeasonActivities
								.map((league) => league.offeringId)
								.filter((offeringId): offeringId is string => Boolean(offeringId))
						);

			const offeringsToCopy = Array.from(offeringIdsForCopy)
				.map((offeringId) => offeringById.get(offeringId))
				.filter((offering): offering is (typeof existingOfferings)[number] => Boolean(offering));

			const usedOfferingSlugs = new Set(
				existingOfferings
					.map((offering) => normalizeSlug(offering.slug))
					.filter((slug): slug is string => slug.length > 0)
			);
			const oldToNewOfferingIds = new Map<string, string>();
			const seasonSlugHint = normalizeSlug(createdSeason.slug ?? input.season.slug) || 'season-copy';

			for (const sourceOffering of offeringsToCopy) {
				if (!sourceOffering.id) continue;
				const baseSlug = normalizeSlug(sourceOffering.slug) || normalizeSlug(sourceOffering.name) || 'offering';
				const newSlug = buildUniqueSlug(`${baseSlug}-${seasonSlugHint}`, usedOfferingSlugs);
				const createdOffering = await dbOps.offerings.create({
					clientId,
					name: sourceOffering.name?.trim() || 'Untitled Offering',
					slug: newSlug,
					isActive: sourceOffering.isActive !== 0 ? 1 : 0,
					imageUrl: sourceOffering.imageUrl ?? null,
					minPlayers: sourceOffering.minPlayers ?? null,
					maxPlayers: sourceOffering.maxPlayers ?? null,
					rulebookUrl: sourceOffering.rulebookUrl ?? null,
					sport: sourceOffering.sport?.trim() || 'Unspecified sport',
					type: normalizeText(sourceOffering.type) === 'tournament' ? 'tournament' : 'league',
					description: sourceOffering.description?.trim() || null,
					createdUser: userId,
					updatedUser: userId
				});

				if (!createdOffering?.id) {
					throw new Error('Unable to copy offering while creating season.');
				}

				oldToNewOfferingIds.set(sourceOffering.id, createdOffering.id);
			}

			const shouldCopyLeagues = scope !== 'offerings-only';
			const oldToNewLeagueIds = new Map<string, string>();
			const parsedNewSeasonLabel = parseSeasonAndYear(createdSeason.name?.trim() || input.season.name);

			if (shouldCopyLeagues) {
				for (const sourceLeague of scopedActivities) {
					if (!sourceLeague.offeringId || !sourceLeague.id) continue;
					const newOfferingId = oldToNewOfferingIds.get(sourceLeague.offeringId);
					if (!newOfferingId) continue;

					const createdLeague = await dbOps.leagues.create({
						clientId,
						offeringId: newOfferingId,
						seasonId: createdSeason.id,
						name: sourceLeague.name?.trim() || 'Untitled League',
						slug: sourceLeague.slug?.trim() || normalizeSlug(sourceLeague.name) || 'league',
						stackOrder: sourceLeague.stackOrder ?? 1,
						description: sourceLeague.description?.trim() || null,
						year: parsedNewSeasonLabel.year,
						season: parsedNewSeasonLabel.season,
						gender:
							sourceLeague.gender === 'male' ||
							sourceLeague.gender === 'female' ||
							sourceLeague.gender === 'mixed'
								? sourceLeague.gender
								: null,
						skillLevel:
							sourceLeague.skillLevel === 'competitive' ||
							sourceLeague.skillLevel === 'intermediate' ||
							sourceLeague.skillLevel === 'recreational' ||
							sourceLeague.skillLevel === 'all'
								? sourceLeague.skillLevel
								: null,
						regStartDate: sourceLeague.regStartDate ?? input.season.startDate,
						regEndDate: sourceLeague.regEndDate ?? input.season.startDate,
						seasonStartDate: sourceLeague.seasonStartDate ?? input.season.startDate,
						seasonEndDate: sourceLeague.seasonEndDate ?? sourceLeague.seasonStartDate ?? input.season.startDate,
						hasPostseason: sourceLeague.hasPostseason === 1 ? 1 : 0,
						postseasonStartDate: sourceLeague.hasPostseason === 1
							? sourceLeague.postseasonStartDate ?? null
							: null,
						postseasonEndDate: sourceLeague.hasPostseason === 1
							? sourceLeague.postseasonEndDate ?? null
							: null,
						hasPreseason: sourceLeague.hasPreseason === 1 ? 1 : 0,
						preseasonStartDate: sourceLeague.hasPreseason === 1
							? sourceLeague.preseasonStartDate ?? null
							: null,
						preseasonEndDate: sourceLeague.hasPreseason === 1
							? sourceLeague.preseasonEndDate ?? null
							: null,
						isActive: sourceLeague.isActive !== 0 ? 1 : 0,
						isLocked: sourceLeague.isLocked === 1 ? 1 : 0,
						imageUrl: sourceLeague.imageUrl ?? null,
						createdUser: userId,
						updatedUser: userId
					});

					if (!createdLeague?.id) {
						throw new Error('Unable to copy league/group while creating season.');
					}

					oldToNewLeagueIds.set(sourceLeague.id, createdLeague.id);
				}
			}

			let copiedDivisionCount = 0;
			if (input.copyOptions.includeDivisions && oldToNewLeagueIds.size > 0) {
				const sourceDivisionLeagues = Array.from(oldToNewLeagueIds.keys());
				const sourceDivisions = await dbOps.divisions.getByLeagueIds(sourceDivisionLeagues);
				for (const sourceDivision of sourceDivisions) {
					if (!sourceDivision.leagueId) continue;
					const newLeagueId = oldToNewLeagueIds.get(sourceDivision.leagueId);
					if (!newLeagueId) continue;

					const copiedDivision = await dbOps.divisions.create({
						leagueId: newLeagueId,
						name: sourceDivision.name?.trim() || 'Untitled Division',
						slug: sourceDivision.slug?.trim() || normalizeSlug(sourceDivision.name) || 'division',
						description: sourceDivision.description?.trim() || null,
						dayOfWeek: sourceDivision.dayOfWeek ?? null,
						gameTime: sourceDivision.gameTime ?? null,
						maxTeams: sourceDivision.maxTeams ?? null,
						location: sourceDivision.location ?? null,
						isActive: sourceDivision.isActive !== 0 ? 1 : 0,
						isLocked: sourceDivision.isLocked === 1 ? 1 : 0,
						teamsCount: sourceDivision.teamsCount ?? null,
						startDate: sourceDivision.startDate ?? null,
						createdUser: userId,
						updatedUser: userId
					});

					if (!copiedDivision?.id) {
						throw new Error('Unable to copy division/group while creating season.');
					}

					copiedDivisionCount += 1;
				}
			}

			copySummary = {
				offeringCount: oldToNewOfferingIds.size,
				leagueCount: oldToNewLeagueIds.size,
				divisionCount: copiedDivisionCount
			};
		}

		return json(
			{
				success: true,
				data: {
					season: {
						id: createdSeason.id,
						name: createdSeason.name?.trim() || input.season.name,
						slug: createdSeason.slug?.trim() || input.season.slug,
						startDate: createdSeason.startDate ?? input.season.startDate,
						endDate: createdSeason.endDate ?? input.season.endDate,
						isCurrent: shouldBeCurrent,
						isActive: createdSeason.isActive !== 0
					},
					copySummary
				}
			} satisfies CreateIntramuralSeasonResponse,
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create intramural season:', error);
		return json(
			{
				success: false,
				error: 'Unable to save season right now.'
			} satisfies CreateIntramuralSeasonResponse,
			{ status: 500 }
		);
	}
};
