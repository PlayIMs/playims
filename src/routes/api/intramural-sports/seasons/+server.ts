import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import {
	createIntramuralSeasonSchema,
	type CreateIntramuralSeasonInput,
	deleteIntramuralSeasonSchema,
	manageIntramuralSeasonSchema,
	type CreateIntramuralSeasonResponse,
	type DeleteIntramuralSeasonInput,
	type DeleteIntramuralSeasonResponse,
	type ManageIntramuralSeasonInput,
	type ManageIntramuralSeasonResponse
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

function formatLegacySeasonLabel(input: {
	season: string | null | undefined;
	year: number | null | undefined;
}): string {
	const season = input.season?.trim() ?? '';
	const year = input.year ?? null;
	if (season && year) return `${season} ${year}`;
	if (season) return season;
	if (year) return `${year}`;
	return '';
}

function buildUniqueSlug(base: string, usedSlugs: Set<string>): string {
	const normalizedBase = normalizeSlug(base) || 'item';
	let candidate = normalizedBase;
	let suffix = 2;

	while (usedSlugs.has(candidate)) {
		candidate = `${normalizedBase}-${suffix}`;
		suffix += 1;
	}

	usedSlugs.add(candidate);
	return candidate;
}

const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertCopiedEntityReceivedNewId(input: {
	entityLabel: string;
	sourceId: string;
	createdId: string;
	createdIdRegistry: Set<string>;
}): void {
	const { entityLabel, sourceId, createdId, createdIdRegistry } = input;
	if (!UUID_V4_REGEX.test(createdId)) {
		throw new Error(`Copied ${entityLabel} did not receive a UUID v4 id.`);
	}
	if (createdId === sourceId) {
		throw new Error(`Copied ${entityLabel} reused source id.`);
	}
	if (createdIdRegistry.has(createdId)) {
		throw new Error(`Copied ${entityLabel} produced a duplicate id.`);
	}
	createdIdRegistry.add(createdId);
}

function parseTemporalToEpochMinutes(
	value: string | null | undefined
): { epochMinutes: number; includesTime: boolean } | null {
	if (!value) return null;
	const normalized = value.trim();
	if (!normalized) return null;

	const dateTimeMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
	if (dateTimeMatch) {
		const year = Number(dateTimeMatch[1]);
		const month = Number(dateTimeMatch[2]);
		const day = Number(dateTimeMatch[3]);
		const hour = Number(dateTimeMatch[4]);
		const minute = Number(dateTimeMatch[5]);
		const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
		if (
			Number.isNaN(date.getTime()) ||
			date.getUTCFullYear() !== year ||
			date.getUTCMonth() + 1 !== month ||
			date.getUTCDate() !== day ||
			date.getUTCHours() !== hour ||
			date.getUTCMinutes() !== minute
		) {
			return null;
		}
		return {
			epochMinutes: Math.floor(date.getTime() / 60000),
			includesTime: true
		};
	}

	const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!dateOnlyMatch) return null;

	const year = Number(dateOnlyMatch[1]);
	const month = Number(dateOnlyMatch[2]);
	const day = Number(dateOnlyMatch[3]);
	const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
	if (
		Number.isNaN(date.getTime()) ||
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() + 1 !== month ||
		date.getUTCDate() !== day
	) {
		return null;
	}

	return {
		epochMinutes: Math.floor(date.getTime() / 60000),
		includesTime: false
	};
}

function formatEpochMinutes(epochMinutes: number, includesTime: boolean): string {
	const date = new Date(epochMinutes * 60000);
	const year = String(date.getUTCFullYear()).padStart(4, '0');
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	if (!includesTime) return `${year}-${month}-${day}`;
	const hour = String(date.getUTCHours()).padStart(2, '0');
	const minute = String(date.getUTCMinutes()).padStart(2, '0');
	return `${year}-${month}-${day}T${hour}:${minute}`;
}

function shiftTemporalRelativeToSeasonStart(
	value: string | null | undefined,
	sourceSeasonStart: string | null | undefined,
	targetSeasonStart: string | null | undefined
): string | null {
	const parsedValue = parseTemporalToEpochMinutes(value);
	const parsedSourceSeasonStart = parseTemporalToEpochMinutes(sourceSeasonStart);
	const parsedTargetSeasonStart = parseTemporalToEpochMinutes(targetSeasonStart);
	if (!parsedValue || !parsedSourceSeasonStart || !parsedTargetSeasonStart) return null;

	const offsetMinutes = parsedValue.epochMinutes - parsedSourceSeasonStart.epochMinutes;
	const shiftedMinutes = parsedTargetSeasonStart.epochMinutes + offsetMinutes;
	return formatEpochMinutes(shiftedMinutes, parsedValue.includesTime);
}

function pickFirstValidTemporal(...candidates: Array<string | null | undefined>): string | null {
	for (const candidate of candidates) {
		const parsed = parseTemporalToEpochMinutes(candidate);
		if (!parsed) continue;
		return formatEpochMinutes(parsed.epochMinutes, parsed.includesTime);
	}
	return null;
}

function toSeasonResponse(
	season: {
		id: string | null;
		name: string | null;
		slug: string | null;
		startDate: string | null;
		endDate: string | null;
		isCurrent: number | null;
		isActive: number | null;
	},
	fallback: { name: string; slug: string; startDate: string; endDate: string | null }
) {
	return {
		id: season.id ?? '',
		name: season.name?.trim() || fallback.name,
		slug: season.slug?.trim() || fallback.slug,
		startDate: season.startDate ?? fallback.startDate,
		endDate: season.endDate ?? fallback.endDate,
		isCurrent: season.isCurrent === 1,
		isActive: season.isActive !== 0
	};
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
			existingSeasons.length === 0 ||
			(input.season.isCurrent && (!existingCurrentSeason || clearExistingCurrent));
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
			const seasonIdSet = new Set(
				existingSeasons
					.map((season) => season.id)
					.filter((seasonId): seasonId is string => Boolean(seasonId))
			);
			const seasonIdByName = new Map(
				existingSeasons
					.filter((season): season is (typeof existingSeasons)[number] & { id: string } =>
						Boolean(season.id)
					)
					.map((season) => [normalizeText(season.name), season.id] as const)
			);
			const resolveLeagueSeasonId = (league: (typeof allLeagues)[number]): string | null => {
				if (league.seasonId && seasonIdSet.has(league.seasonId)) return league.seasonId;
				const legacySeasonLabel = formatLegacySeasonLabel({
					season: league.season,
					year: league.year
				});
				if (!legacySeasonLabel) return null;
				return seasonIdByName.get(normalizeText(legacySeasonLabel)) ?? null;
			};
			const sourceSeasonStartDate =
				existingSeasons.find((season) => season.id === sourceSeasonId)?.startDate ?? null;
			const targetSeasonStartDate = createdSeason.startDate ?? input.season.startDate;

			const sourceSeasonLeagues = allLeagues.filter(
				(league) => resolveLeagueSeasonId(league) === sourceSeasonId
			);
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
					.filter((offering) => offering.seasonId === createdSeason.id)
					.map((offering) => normalizeSlug(offering.slug))
					.filter((slug): slug is string => slug.length > 0)
			);
			const oldToNewOfferingIds = new Map<string, string>();
			const generatedOfferingIds = new Set<string>();
			const usedLeagueSlugs = new Set(
				allLeagues
					.filter((league) => resolveLeagueSeasonId(league) === createdSeason.id)
					.map((league) => normalizeSlug(league.slug))
					.filter((slug): slug is string => slug.length > 0)
			);
			const generatedLeagueIds = new Set<string>();

			for (const sourceOffering of offeringsToCopy) {
				if (!sourceOffering.id) continue;
				const baseSlug =
					normalizeSlug(sourceOffering.slug) || normalizeSlug(sourceOffering.name) || 'offering';
				const newSlug = buildUniqueSlug(baseSlug, usedOfferingSlugs);
				const createdOffering = await dbOps.offerings.create({
					clientId,
					seasonId: createdSeason.id,
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
				assertCopiedEntityReceivedNewId({
					entityLabel: 'offering',
					sourceId: sourceOffering.id,
					createdId: createdOffering.id,
					createdIdRegistry: generatedOfferingIds
				});

				oldToNewOfferingIds.set(sourceOffering.id, createdOffering.id);
			}

			const shouldCopyLeagues = scope !== 'offerings-only';
			const oldToNewLeagueIds = new Map<string, string>();
			const parsedNewSeasonLabel = parseSeasonAndYear(
				createdSeason.name?.trim() || input.season.name
			);

			if (shouldCopyLeagues) {
				for (const sourceLeague of scopedActivities) {
					if (!sourceLeague.offeringId || !sourceLeague.id) continue;
					const newOfferingId = oldToNewOfferingIds.get(sourceLeague.offeringId);
					if (!newOfferingId) continue;
					const sourceLeagueBaseSlug =
						normalizeSlug(sourceLeague.slug) || normalizeSlug(sourceLeague.name) || 'league';
					const newLeagueSlug = buildUniqueSlug(sourceLeagueBaseSlug, usedLeagueSlugs);
					const shiftedSeasonStartDate = shiftTemporalRelativeToSeasonStart(
						sourceLeague.seasonStartDate,
						sourceSeasonStartDate,
						targetSeasonStartDate
					);
					const resolvedSeasonStartDate =
						pickFirstValidTemporal(
							shiftedSeasonStartDate,
							sourceLeague.seasonStartDate,
							targetSeasonStartDate
						) ?? targetSeasonStartDate;
					const shiftedSeasonEndDate = shiftTemporalRelativeToSeasonStart(
						sourceLeague.seasonEndDate,
						sourceSeasonStartDate,
						targetSeasonStartDate
					);
					const resolvedSeasonEndDate =
						pickFirstValidTemporal(
							shiftedSeasonEndDate,
							sourceLeague.seasonEndDate,
							resolvedSeasonStartDate
						) ?? resolvedSeasonStartDate;
					const shiftedRegStartDate = shiftTemporalRelativeToSeasonStart(
						sourceLeague.regStartDate,
						sourceSeasonStartDate,
						targetSeasonStartDate
					);
					const resolvedRegStartDate =
						pickFirstValidTemporal(
							shiftedRegStartDate,
							sourceLeague.regStartDate,
							resolvedSeasonStartDate
						) ?? resolvedSeasonStartDate;
					const shiftedRegEndDate = shiftTemporalRelativeToSeasonStart(
						sourceLeague.regEndDate,
						sourceSeasonStartDate,
						targetSeasonStartDate
					);
					const resolvedRegEndDate =
						pickFirstValidTemporal(
							shiftedRegEndDate,
							sourceLeague.regEndDate,
							resolvedRegStartDate
						) ?? resolvedRegStartDate;
					const resolvedPreseasonStartDate =
						sourceLeague.hasPreseason === 1
							? pickFirstValidTemporal(
									shiftTemporalRelativeToSeasonStart(
										sourceLeague.preseasonStartDate,
										sourceSeasonStartDate,
										targetSeasonStartDate
									),
									sourceLeague.preseasonStartDate
								)
							: null;
					const resolvedPreseasonEndDate =
						sourceLeague.hasPreseason === 1
							? pickFirstValidTemporal(
									shiftTemporalRelativeToSeasonStart(
										sourceLeague.preseasonEndDate,
										sourceSeasonStartDate,
										targetSeasonStartDate
									),
									sourceLeague.preseasonEndDate
								)
							: null;
					const resolvedPostseasonStartDate =
						sourceLeague.hasPostseason === 1
							? pickFirstValidTemporal(
									shiftTemporalRelativeToSeasonStart(
										sourceLeague.postseasonStartDate,
										sourceSeasonStartDate,
										targetSeasonStartDate
									),
									sourceLeague.postseasonStartDate
								)
							: null;
					const resolvedPostseasonEndDate =
						sourceLeague.hasPostseason === 1
							? pickFirstValidTemporal(
									shiftTemporalRelativeToSeasonStart(
										sourceLeague.postseasonEndDate,
										sourceSeasonStartDate,
										targetSeasonStartDate
									),
									sourceLeague.postseasonEndDate
								)
							: null;

					const createdLeague = await dbOps.leagues.create({
						clientId,
						offeringId: newOfferingId,
						seasonId: createdSeason.id,
						name: sourceLeague.name?.trim() || 'Untitled League',
						slug: newLeagueSlug,
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
						regStartDate: resolvedRegStartDate,
						regEndDate: resolvedRegEndDate,
						seasonStartDate: resolvedSeasonStartDate,
						seasonEndDate: resolvedSeasonEndDate,
						hasPostseason: sourceLeague.hasPostseason === 1 ? 1 : 0,
						postseasonStartDate:
							sourceLeague.hasPostseason === 1 ? resolvedPostseasonStartDate : null,
						postseasonEndDate: sourceLeague.hasPostseason === 1 ? resolvedPostseasonEndDate : null,
						hasPreseason: sourceLeague.hasPreseason === 1 ? 1 : 0,
						preseasonStartDate: sourceLeague.hasPreseason === 1 ? resolvedPreseasonStartDate : null,
						preseasonEndDate: sourceLeague.hasPreseason === 1 ? resolvedPreseasonEndDate : null,
						isActive: sourceLeague.isActive !== 0 ? 1 : 0,
						isLocked: sourceLeague.isLocked === 1 ? 1 : 0,
						imageUrl: sourceLeague.imageUrl ?? null,
						createdUser: userId,
						updatedUser: userId
					});

					if (!createdLeague?.id) {
						throw new Error('Unable to copy league/group while creating season.');
					}
					assertCopiedEntityReceivedNewId({
						entityLabel: 'league/group',
						sourceId: sourceLeague.id,
						createdId: createdLeague.id,
						createdIdRegistry: generatedLeagueIds
					});

					oldToNewLeagueIds.set(sourceLeague.id, createdLeague.id);
				}
			}

			let copiedDivisionCount = 0;
			if (input.copyOptions.includeDivisions && oldToNewLeagueIds.size > 0) {
				const sourceDivisionLeagues = Array.from(oldToNewLeagueIds.keys());
				const sourceDivisions = await dbOps.divisions.getByLeagueIds(sourceDivisionLeagues);
				const generatedDivisionIds = new Set<string>();
				const usedDivisionSlugsByLeague = new Map<string, Set<string>>();
				for (const sourceDivision of sourceDivisions) {
					if (!sourceDivision.leagueId) continue;
					const newLeagueId = oldToNewLeagueIds.get(sourceDivision.leagueId);
					if (!newLeagueId) continue;
					if (!usedDivisionSlugsByLeague.has(newLeagueId)) {
						usedDivisionSlugsByLeague.set(newLeagueId, new Set());
					}
					const usedDivisionSlugs = usedDivisionSlugsByLeague.get(newLeagueId) as Set<string>;
					const sourceDivisionBaseSlug =
						normalizeSlug(sourceDivision.slug) || normalizeSlug(sourceDivision.name) || 'division';
					const newDivisionSlug = buildUniqueSlug(sourceDivisionBaseSlug, usedDivisionSlugs);

					const copiedDivision = await dbOps.divisions.create({
						leagueId: newLeagueId,
						name: sourceDivision.name?.trim() || 'Untitled Division',
						slug: newDivisionSlug,
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
					assertCopiedEntityReceivedNewId({
						entityLabel: 'division/group',
						sourceId: sourceDivision.id,
						createdId: copiedDivision.id,
						createdIdRegistry: generatedDivisionIds
					});

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

export const PATCH: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to update season right now.'
			} satisfies ManageIntramuralSeasonResponse,
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
			} satisfies ManageIntramuralSeasonResponse,
			{ status: 400 }
		);
	}

	const parsed = manageIntramuralSeasonSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies ManageIntramuralSeasonResponse,
			{ status: 400 }
		);
	}

	const input: ManageIntramuralSeasonInput = parsed.data;
	const dbOps = new DatabaseOperations(event.platform as App.Platform);
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);

	try {
		const seasons = await dbOps.seasons.getByClientId(clientId);
		const targetSeason = seasons.find((season) => season.id === input.seasonId) ?? null;
		if (!targetSeason?.id) {
			return json(
				{
					success: false,
					error: 'Season not found.'
				} satisfies ManageIntramuralSeasonResponse,
				{ status: 404 }
			);
		}

		if (input.action === 'update-details') {
			const duplicateSlug = seasons.find(
				(season) =>
					season.id !== targetSeason.id && normalizeText(season.slug) === normalizeText(input.slug)
			);
			const duplicateName = seasons.find(
				(season) =>
					season.id !== targetSeason.id && normalizeText(season.name) === normalizeText(input.name)
			);
			const duplicateIssues: Array<{ path: Array<string>; message: string }> = [];
			if (duplicateSlug) {
				duplicateIssues.push({
					path: ['slug'],
					message: 'A season with this slug already exists.'
				});
			}
			if (duplicateName) {
				duplicateIssues.push({
					path: ['name'],
					message: 'A season with this name already exists.'
				});
			}
			if (duplicateIssues.length > 0) {
				return json(
					{
						success: false,
						error: 'Duplicate season detected.',
						fieldErrors: toFieldErrorMap(duplicateIssues)
					} satisfies ManageIntramuralSeasonResponse,
					{ status: 409 }
				);
			}

			const updated = await dbOps.seasons.updateDetails(
				clientId,
				targetSeason.id,
				{
					name: input.name,
					slug: input.slug,
					startDate: input.startDate,
					endDate: input.endDate
				},
				userId
			);
			if (!updated?.id) {
				return json(
					{
						success: false,
						error: 'Unable to update season right now.'
					} satisfies ManageIntramuralSeasonResponse,
					{ status: 500 }
				);
			}

			return json({
				success: true,
				data: {
					season: toSeasonResponse(updated, {
						name: input.name,
						slug: input.slug,
						startDate: input.startDate,
						endDate: input.endDate
					}),
					currentSeasonId:
						(seasons.find((season) => season.isCurrent === 1)?.id as string | undefined) ?? null
				}
			} satisfies ManageIntramuralSeasonResponse);
		}

		if (input.action === 'set-current') {
			if (targetSeason.isActive === 0) {
				await dbOps.seasons.setActive(clientId, targetSeason.id, true, userId);
			}
			await dbOps.seasons.setCurrent(clientId, targetSeason.id, userId);
			const refreshed = await dbOps.seasons.getByClientIdAndId(clientId, targetSeason.id);
			return json({
				success: true,
				data: {
					season: refreshed
						? toSeasonResponse(refreshed, {
								name: targetSeason.name?.trim() || 'Season',
								slug: targetSeason.slug?.trim() || normalizeSlug(targetSeason.name || 'season'),
								startDate: targetSeason.startDate ?? '',
								endDate: targetSeason.endDate ?? null
							})
						: undefined,
					currentSeasonId: targetSeason.id
				}
			} satisfies ManageIntramuralSeasonResponse);
		}

		const settingActive = input.isActive;
		if (!settingActive) {
			const isCurrent = targetSeason.isCurrent === 1;
			if (isCurrent) {
				const fallback = seasons
					.filter((season) => season.id && season.id !== targetSeason.id && season.isActive !== 0)
					.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];

				if (!fallback?.id) {
					return json(
						{
							success: false,
							error:
								'Cannot archive or deactivate the current season because no fallback active season exists.'
						} satisfies ManageIntramuralSeasonResponse,
						{ status: 400 }
					);
				}

				await dbOps.seasons.setCurrent(clientId, fallback.id, userId);
			}
		}

		await dbOps.seasons.setActive(clientId, targetSeason.id, settingActive, userId);
		const refreshed = await dbOps.seasons.getByClientId(clientId);
		const updatedTarget = refreshed.find((season) => season.id === targetSeason.id) ?? targetSeason;
		const currentSeasonId =
			(refreshed.find((season) => season.isCurrent === 1)?.id as string | undefined) ?? null;
		return json({
			success: true,
			data: {
				season: toSeasonResponse(updatedTarget, {
					name: targetSeason.name?.trim() || 'Season',
					slug: targetSeason.slug?.trim() || normalizeSlug(targetSeason.name || 'season'),
					startDate: targetSeason.startDate ?? '',
					endDate: targetSeason.endDate ?? null
				}),
				currentSeasonId
			}
		} satisfies ManageIntramuralSeasonResponse);
	} catch (error) {
		console.error('Failed to update intramural season:', error);
		return json(
			{
				success: false,
				error: 'Unable to update season right now.'
			} satisfies ManageIntramuralSeasonResponse,
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{
				success: false,
				error: 'Unable to delete season right now.'
			} satisfies DeleteIntramuralSeasonResponse,
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
			} satisfies DeleteIntramuralSeasonResponse,
			{ status: 400 }
		);
	}

	const parsed = deleteIntramuralSeasonSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			} satisfies DeleteIntramuralSeasonResponse,
			{ status: 400 }
		);
	}

	const input: DeleteIntramuralSeasonInput = parsed.data;
	const dbOps = new DatabaseOperations(event.platform as App.Platform);
	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const d1 = event.platform.env.DB;

	try {
		const seasons = await dbOps.seasons.getByClientId(clientId);
		const targetSeason = seasons.find((season) => season.id === input.seasonId) ?? null;
		if (!targetSeason?.id) {
			return json(
				{
					success: false,
					error: 'Season not found.'
				} satisfies DeleteIntramuralSeasonResponse,
				{ status: 404 }
			);
		}

		const expectedSlug = normalizeSlug(targetSeason.slug || targetSeason.name || '');
		if (normalizeSlug(input.confirmSlug) !== expectedSlug) {
			return json(
				{
					success: false,
					error: 'Season slug confirmation did not match.',
					fieldErrors: {
						confirmSlug: ['Enter the exact season slug to confirm deletion.']
					}
				} satisfies DeleteIntramuralSeasonResponse,
				{ status: 400 }
			);
		}

		const fallbackCurrentSeason = seasons
			.filter((season) => season.id && season.id !== targetSeason.id && season.isActive !== 0)
			.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0];
		if (targetSeason.isCurrent === 1 && seasons.length > 1 && !fallbackCurrentSeason?.id) {
			return json(
				{
					success: false,
					error: 'Cannot delete current season because no fallback active season exists.'
				} satisfies DeleteIntramuralSeasonResponse,
				{ status: 400 }
			);
		}

		if (targetSeason.isCurrent === 1 && fallbackCurrentSeason?.id) {
			await dbOps.seasons.setCurrent(clientId, fallbackCurrentSeason.id, userId);
		}

		const deletedAt = new Date().toISOString();
		const deleteBatchId = crypto.randomUUID();
		const deleteReason = input.reason?.trim() || null;
		const orphanOfferingIdSubquery = `
			SELECT DISTINCT l.offering_id
			FROM leagues l
			WHERE l.client_id = ? AND l.season_id = ? AND l.offering_id IS NOT NULL
				AND NOT EXISTS (
					SELECT 1
					FROM leagues other
					WHERE other.client_id = l.client_id
						AND other.offering_id = l.offering_id
						AND other.season_id <> ?
				)
		`;
		const leagueIdSubquery = `SELECT id FROM leagues WHERE client_id = ? AND season_id = ?`;
		const divisionIdSubquery = `SELECT id FROM divisions WHERE league_id IN (${leagueIdSubquery})`;
		const teamIdSubquery = `SELECT id FROM teams WHERE client_id = ? AND division_id IN (${divisionIdSubquery})`;
		const bracketIdSubquery = `
			SELECT id
			FROM brackets
			WHERE client_id = ?
				AND (
					league_id IN (${leagueIdSubquery})
					OR division_id IN (${divisionIdSubquery})
				)
		`;

		await d1
			.prepare(
				`INSERT INTO delete_batches (id, client_id, season_id, season_name, reason, deleted_user, deleted_at, metadata)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				deleteBatchId,
				clientId,
				targetSeason.id,
				targetSeason.name?.trim() || 'Season',
				deleteReason,
				userId,
				deletedAt,
				JSON.stringify({
					source: 'intramural-seasons-api',
					cascade: 'season-linked'
				})
			)
			.run();

		await d1
			.prepare(`INSERT INTO seasons_deleted SELECT seasons.*, ?, ?, ?, ? FROM seasons WHERE id = ?`)
			.bind(deleteBatchId, deletedAt, userId, deleteReason, targetSeason.id)
			.run();
		await d1
			.prepare(
				`INSERT INTO leagues_deleted
				 SELECT leagues.*, ?, ?, ?, ?
				 FROM leagues
				 WHERE client_id = ? AND season_id = ?`
			)
			.bind(deleteBatchId, deletedAt, userId, deleteReason, clientId, targetSeason.id)
			.run();
		await d1
			.prepare(
				`INSERT INTO divisions_deleted
				 SELECT divisions.*, ?, ?, ?, ?
				 FROM divisions
				 WHERE league_id IN (${leagueIdSubquery})`
			)
			.bind(deleteBatchId, deletedAt, userId, deleteReason, clientId, targetSeason.id)
			.run();
		await d1
			.prepare(
				`INSERT INTO teams_deleted
				 SELECT teams.*, ?, ?, ?, ?
				 FROM teams
				 WHERE client_id = ? AND division_id IN (${divisionIdSubquery})`
			)
			.bind(deleteBatchId, deletedAt, userId, deleteReason, clientId, clientId, targetSeason.id)
			.run();
		await d1
			.prepare(
				`INSERT INTO rosters_deleted
				 SELECT rosters.*, ?, ?, ?, ?
				 FROM rosters
				 WHERE client_id = ? AND team_id IN (${teamIdSubquery})`
			)
			.bind(
				deleteBatchId,
				deletedAt,
				userId,
				deleteReason,
				clientId,
				clientId,
				clientId,
				targetSeason.id
			)
			.run();
		await d1
			.prepare(
				`INSERT INTO events_deleted
				 SELECT events.*, ?, ?, ?, ?
				 FROM events
				 WHERE client_id = ?
					 AND (
						league_id IN (${leagueIdSubquery})
						OR division_id IN (${divisionIdSubquery})
						OR offering_id IN (${orphanOfferingIdSubquery})
					 )`
			)
			.bind(
				deleteBatchId,
				deletedAt,
				userId,
				deleteReason,
				clientId,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id,
				targetSeason.id
			)
			.run();
		await d1
			.prepare(
				`INSERT INTO announcements_deleted
				 SELECT announcements.*, ?, ?, ?, ?
				 FROM announcements
				 WHERE client_id = ?
					 AND (
						league_id IN (${leagueIdSubquery})
						OR division_id IN (${divisionIdSubquery})
					 )`
			)
			.bind(
				deleteBatchId,
				deletedAt,
				userId,
				deleteReason,
				clientId,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id
			)
			.run();
		await d1
			.prepare(
				`INSERT INTO brackets_deleted
				 SELECT brackets.*, ?, ?, ?, ?
				 FROM brackets
				 WHERE client_id = ?
					 AND (
						league_id IN (${leagueIdSubquery})
						OR division_id IN (${divisionIdSubquery})
					 )`
			)
			.bind(
				deleteBatchId,
				deletedAt,
				userId,
				deleteReason,
				clientId,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id
			)
			.run();
		await d1
			.prepare(
				`INSERT INTO division_standings_deleted
				 SELECT division_standings.*, ?, ?, ?, ?
				 FROM division_standings
				 WHERE client_id = ?
					 AND (
						league_id IN (${leagueIdSubquery})
						OR division_id IN (${divisionIdSubquery})
						OR team_id IN (${teamIdSubquery})
					 )`
			)
			.bind(
				deleteBatchId,
				deletedAt,
				userId,
				deleteReason,
				clientId,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id,
				clientId,
				clientId,
				targetSeason.id
			)
			.run();
		await d1
			.prepare(
				`INSERT INTO bracket_entries_deleted
				 SELECT bracket_entries.*, ?, ?, ?, ?
				 FROM bracket_entries
				 WHERE client_id = ?
					 AND (
						bracket_id IN (${bracketIdSubquery})
						OR team_id IN (${teamIdSubquery})
					 )`
			)
			.bind(
				deleteBatchId,
				deletedAt,
				userId,
				deleteReason,
				clientId,
				clientId,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id,
				clientId,
				clientId,
				targetSeason.id
			)
			.run();
		await d1
			.prepare(
				`INSERT INTO offerings_deleted
				 SELECT offerings.*, ?, ?, ?, ?
				 FROM offerings
				 WHERE client_id = ?
					 AND id IN (${orphanOfferingIdSubquery})`
			)
			.bind(
				deleteBatchId,
				deletedAt,
				userId,
				deleteReason,
				clientId,
				clientId,
				targetSeason.id,
				targetSeason.id
			)
			.run();

		await d1
			.prepare(
				`DELETE FROM rosters
				 WHERE client_id = ? AND team_id IN (${teamIdSubquery})`
			)
			.bind(clientId, clientId, clientId, targetSeason.id)
			.run();
		await d1
			.prepare(
				`DELETE FROM bracket_entries
				 WHERE client_id = ?
					 AND (
						bracket_id IN (${bracketIdSubquery})
						OR team_id IN (${teamIdSubquery})
					 )`
			)
			.bind(
				clientId,
				clientId,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id,
				clientId,
				clientId,
				targetSeason.id
			)
			.run();
		await d1
			.prepare(
				`DELETE FROM division_standings
				 WHERE client_id = ?
					 AND (
						league_id IN (${leagueIdSubquery})
						OR division_id IN (${divisionIdSubquery})
						OR team_id IN (${teamIdSubquery})
					 )`
			)
			.bind(
				clientId,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id,
				clientId,
				clientId,
				targetSeason.id
			)
			.run();
		await d1
			.prepare(
				`DELETE FROM events
				 WHERE client_id = ?
					 AND (
						league_id IN (${leagueIdSubquery})
						OR division_id IN (${divisionIdSubquery})
						OR offering_id IN (${orphanOfferingIdSubquery})
					 )`
			)
			.bind(
				clientId,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id,
				clientId,
				targetSeason.id,
				targetSeason.id
			)
			.run();
		await d1
			.prepare(
				`DELETE FROM announcements
				 WHERE client_id = ?
					 AND (
						league_id IN (${leagueIdSubquery})
						OR division_id IN (${divisionIdSubquery})
					 )`
			)
			.bind(clientId, clientId, targetSeason.id, clientId, targetSeason.id)
			.run();
		await d1
			.prepare(
				`DELETE FROM brackets
				 WHERE client_id = ?
					 AND (
						league_id IN (${leagueIdSubquery})
						OR division_id IN (${divisionIdSubquery})
					 )`
			)
			.bind(clientId, clientId, targetSeason.id, clientId, targetSeason.id)
			.run();
		await d1
			.prepare(
				`DELETE FROM teams
				 WHERE client_id = ? AND division_id IN (${divisionIdSubquery})`
			)
			.bind(clientId, clientId, targetSeason.id)
			.run();
		await d1
			.prepare(`DELETE FROM divisions WHERE league_id IN (${leagueIdSubquery})`)
			.bind(clientId, targetSeason.id)
			.run();
		await d1
			.prepare(`DELETE FROM leagues WHERE client_id = ? AND season_id = ?`)
			.bind(clientId, targetSeason.id)
			.run();
		await d1
			.prepare(
				`DELETE FROM offerings
				 WHERE client_id = ?
					 AND id IN (${orphanOfferingIdSubquery})`
			)
			.bind(clientId, clientId, targetSeason.id, targetSeason.id)
			.run();
		await d1
			.prepare(`DELETE FROM seasons WHERE client_id = ? AND id = ?`)
			.bind(clientId, targetSeason.id)
			.run();

		const remainingSeasons = await dbOps.seasons.getByClientId(clientId);
		let currentSeasonId =
			(remainingSeasons.find((season) => season.isCurrent === 1)?.id as string | undefined) ?? null;
		if (!currentSeasonId && remainingSeasons.length > 0) {
			const fallback =
				remainingSeasons.find((season) => season.isActive !== 0) ?? remainingSeasons[0];
			if (fallback?.id) {
				await dbOps.seasons.setCurrent(clientId, fallback.id, userId);
				currentSeasonId = fallback.id;
			}
		}

		return json({
			success: true,
			data: {
				deletedSeasonId: targetSeason.id,
				currentSeasonId
			}
		} satisfies DeleteIntramuralSeasonResponse);
	} catch (error) {
		console.error('Failed to delete intramural season:', error);
		return json(
			{
				success: false,
				error: 'Unable to delete season right now.'
			} satisfies DeleteIntramuralSeasonResponse,
			{ status: 500 }
		);
	}
};
