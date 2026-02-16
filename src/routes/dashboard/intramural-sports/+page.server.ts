import { DatabaseOperations } from '$lib/database';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import type { Division } from '$lib/database/schema/divisions';
import type { League } from '$lib/database/schema/leagues';
import type { Offering } from '$lib/database/schema/offerings';
import type { Season } from '$lib/database/schema/seasons';
import type { PageServerLoad } from './$types';

type ActivityType = 'league' | 'tournament';

interface ActivityCard {
	id: string;
	offeringId: string | null;
	leagueId: string | null;
	seasonId: string | null;
	stackOrder: number | null;
	offeringType: ActivityType;
	offeringName: string;
	leagueName: string;
	seasonLabel: string;
	season: string | null;
	year: number | null;
	gender: string | null;
	skillLevel: string | null;
	registrationStart: string | null;
	registrationEnd: string | null;
	seasonStart: string | null;
	seasonEnd: string | null;
	divisionCount: number;
	spotsRemaining: number | null;
	isLocked: boolean;
	isActive: boolean;
}

interface SeasonOption {
	id: string;
	name: string;
	startDate: string;
	endDate: string | null;
	isCurrent: boolean;
	isActive: boolean;
}

interface LeagueOfferingOption {
	id: string;
	name: string;
	sport: string;
	type: ActivityType;
	isActive: boolean;
}

interface ExistingLeagueTemplate {
	id: string;
	offeringId: string;
	seasonId: string;
	name: string;
	slug: string;
	description: string | null;
	season: string | null;
	gender: string | null;
	skillLevel: string | null;
	regStartDate: string | null;
	regEndDate: string | null;
	seasonStartDate: string | null;
	seasonEndDate: string | null;
	hasPostseason: boolean;
	postseasonStartDate: string | null;
	postseasonEndDate: string | null;
	hasPreseason: boolean;
	preseasonStartDate: string | null;
	preseasonEndDate: string | null;
	isActive: boolean;
	isLocked: boolean;
	imageUrl: string | null;
	stackOrder: number | null;
}

function toActivityType(value: string | null | undefined): ActivityType {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'tournament') return 'tournament';
	return 'league';
}

function formatLegacySeasonLabel(league: League): string {
	const season = league.season?.trim() ?? '';
	const year = league.year ?? null;
	if (season && year) return `${season} ${year}`;
	if (season) return season;
	if (year) return `${year}`;
	return 'Unscheduled';
}

function parseYearFromLabel(label: string): number | null {
	const match = label.match(/\b(\d{4})\b/);
	if (!match?.[1]) return null;
	const parsed = Number(match[1]);
	return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSeasonName(value: string | null | undefined): string {
	return value?.trim().toLowerCase() ?? '';
}

function createDivisionCountByLeague(
	divisions: Division[],
	leagueIds: Set<string>
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const division of divisions) {
		if (!division.leagueId || !leagueIds.has(division.leagueId)) continue;
		counts.set(division.leagueId, (counts.get(division.leagueId) ?? 0) + 1);
	}
	return counts;
}

function sortSeasonsDescending(a: SeasonOption, b: SeasonOption): number {
	return b.startDate.localeCompare(a.startDate);
}

function resolveDefaultSeasonId(seasons: SeasonOption[]): string | null {
	if (seasons.length === 0) return null;

	const explicitCurrent = seasons.find((season) => season.isCurrent);
	if (explicitCurrent) return explicitCurrent.id;

	const now = new Date().toISOString().slice(0, 10);
	const inRange = seasons.find((season) => season.startDate <= now && (!season.endDate || season.endDate >= now));
	if (inRange) return inRange.id;

	const started = seasons.filter((season) => season.startDate <= now).sort(sortSeasonsDescending);
	if (started[0]) return started[0].id;

	const upcoming = [...seasons].sort((a, b) => a.startDate.localeCompare(b.startDate));
	return upcoming[0]?.id ?? null;
}

export const load: PageServerLoad = async ({ platform, locals }) => {
	const setRequestLogMeta = (recordCount: number) => {
		locals.requestLogMeta = {
			table: 'seasons,offerings,leagues,divisions',
			recordCount: Math.max(0, recordCount)
		};
	};

	if (!platform?.env?.DB) {
		setRequestLogMeta(0);
		return {
			seasons: [] as SeasonOption[],
			currentSeasonId: null as string | null,
			activities: [] as ActivityCard[],
			leagueOfferingOptions: [] as LeagueOfferingOption[],
			leagueTemplates: [] as ExistingLeagueTemplate[],
			error: 'Database not configured'
		};
	}

	const db = new DatabaseOperations(platform);
	const clientId = requireAuthenticatedClientId(locals);

	try {
		const [seasonsRaw, offerings, leagues] = await Promise.all([
			db.seasons.getByClientId(clientId),
			db.offerings.getByClientId(clientId),
			db.leagues.getByClientId(clientId)
		]);

		const leagueIds = leagues
			.map((league) => league.id)
			.filter((leagueId): leagueId is string => Boolean(leagueId));
		const divisions = await db.divisions.getByLeagueIds(leagueIds);
		setRequestLogMeta(seasonsRaw.length + offerings.length + leagues.length + divisions.length);

		const seasons: SeasonOption[] = seasonsRaw
			.filter((season): season is Season & { id: string } => Boolean(season.id))
			.map((season) => ({
				id: season.id,
				name: season.name?.trim() || 'Unnamed Season',
				startDate: season.startDate ?? '',
				endDate: season.endDate ?? null,
				isCurrent: season.isCurrent === 1,
				isActive: season.isActive !== 0
			}))
			.filter((season) => season.startDate.trim().length > 0)
			.sort(sortSeasonsDescending);

		const seasonsById = new Map(seasons.map((season) => [season.id, season]));
		const seasonIdByName = new Map(
			seasons.map((season) => [normalizeSeasonName(season.name), season.id])
		);
		const currentSeasonId = resolveDefaultSeasonId(seasons);

		const resolveLeagueSeasonId = (league: League): string | null => {
			if (league.seasonId && seasonsById.has(league.seasonId)) return league.seasonId;
			const legacySeasonLabel = formatLegacySeasonLabel(league);
			if (!legacySeasonLabel || legacySeasonLabel === 'Unscheduled') return null;
			return seasonIdByName.get(normalizeSeasonName(legacySeasonLabel)) ?? null;
		};

		const leagueIdSet = new Set(leagueIds);
		const divisionCountByLeague = createDivisionCountByLeague(divisions, leagueIdSet);
		const offeringsById = new Map(
			offerings
				.filter((offering): offering is Offering & { id: string } => Boolean(offering.id))
				.map((offering) => [offering.id, offering])
		);

		const activities = leagues
			.map<ActivityCard>((league, index) => {
				const resolvedId = league.id ?? `league-${index + 1}`;
				const offering = league.offeringId ? offeringsById.get(league.offeringId) : undefined;
				const offeringName = offering?.name?.trim() || 'General Recreation';
				const offeringType = toActivityType(offering?.type);

				const resolvedSeasonId = resolveLeagueSeasonId(league);
				const linkedSeason = resolvedSeasonId ? seasonsById.get(resolvedSeasonId) : undefined;
				const seasonLabel = linkedSeason?.name ?? formatLegacySeasonLabel(league);
				const divisionCount = league.id ? (divisionCountByLeague.get(league.id) ?? 0) : 0;

				return {
					id: resolvedId,
					offeringId: league.offeringId ?? null,
					leagueId: league.id ?? null,
					seasonId: linkedSeason?.id ?? resolvedSeasonId ?? null,
					stackOrder: league.stackOrder ?? null,
					offeringType,
					offeringName,
					leagueName: league.name?.trim() || 'Untitled League',
					seasonLabel,
					season: linkedSeason?.name ?? league.season ?? null,
					year: parseYearFromLabel(seasonLabel),
					gender: league.gender ?? null,
					skillLevel: league.skillLevel ?? null,
					registrationStart: league.regStartDate ?? null,
					registrationEnd: league.regEndDate ?? null,
					seasonStart: league.seasonStartDate ?? null,
					seasonEnd: league.seasonEndDate ?? null,
					divisionCount,
					spotsRemaining: null,
					isLocked: league.isLocked === 1,
					isActive: league.isActive !== 0
				};
			})
			.sort((a, b) => {
				const nameDiff = a.offeringName.localeCompare(b.offeringName);
				if (nameDiff !== 0) return nameDiff;
				const aStackOrder = a.stackOrder ?? Number.MAX_SAFE_INTEGER;
				const bStackOrder = b.stackOrder ?? Number.MAX_SAFE_INTEGER;
				if (aStackOrder !== bStackOrder) return aStackOrder - bStackOrder;
				return a.leagueName.localeCompare(b.leagueName);
			});

		const leagueOfferingOptions = offerings
			.filter((offering): offering is Offering & { id: string } => Boolean(offering.id))
			.map<LeagueOfferingOption>((offering) => ({
				id: offering.id,
				name: offering.name?.trim() || 'Untitled Offering',
				sport: offering.sport?.trim() || 'Unspecified sport',
				type: toActivityType(offering.type),
				isActive: offering.isActive !== 0
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		const leagueTemplates = leagues
			.filter((league): league is League & { id: string; offeringId: string } => {
				return Boolean(league.id) && Boolean(league.offeringId);
			})
			.map((league) => {
				const resolvedSeasonId = resolveLeagueSeasonId(league);
				if (!resolvedSeasonId) return null;
				return {
					id: league.id,
					offeringId: league.offeringId,
					seasonId: resolvedSeasonId,
					name: league.name?.trim() || 'Untitled League',
					slug: league.slug?.trim() || '',
					description: league.description?.trim() || null,
					season: seasonsById.get(resolvedSeasonId)?.name ?? (league.season?.trim() || null),
					gender: league.gender?.trim() || null,
					skillLevel: league.skillLevel?.trim() || null,
					regStartDate: league.regStartDate ?? null,
					regEndDate: league.regEndDate ?? null,
					seasonStartDate: league.seasonStartDate ?? null,
					seasonEndDate: league.seasonEndDate ?? null,
					hasPostseason: league.hasPostseason === 1,
					postseasonStartDate: league.postseasonStartDate ?? null,
					postseasonEndDate: league.postseasonEndDate ?? null,
					hasPreseason: league.hasPreseason === 1,
					preseasonStartDate: league.preseasonStartDate ?? null,
					preseasonEndDate: league.preseasonEndDate ?? null,
					isActive: league.isActive !== 0,
					isLocked: league.isLocked === 1,
					imageUrl: league.imageUrl ?? null,
					stackOrder: league.stackOrder ?? null
				} satisfies ExistingLeagueTemplate;
			})
			.filter((league): league is ExistingLeagueTemplate => Boolean(league));

		return {
			seasons,
			currentSeasonId,
			activities,
			leagueOfferingOptions,
			leagueTemplates
		};
	} catch (error) {
		setRequestLogMeta(0);
		console.error('Failed to load intramural offerings page:', error);
		return {
			seasons: [] as SeasonOption[],
			currentSeasonId: null as string | null,
			activities: [] as ActivityCard[],
			leagueOfferingOptions: [] as LeagueOfferingOption[],
			leagueTemplates: [] as ExistingLeagueTemplate[],
			error: 'Unable to load intramural offerings right now'
		};
	}
};
