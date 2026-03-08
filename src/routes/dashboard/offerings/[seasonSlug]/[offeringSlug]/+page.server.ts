import { error } from '@sveltejs/kit';
import type { League, Offering, Season } from '$lib/database';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import type { PageServerLoad } from './$types';

interface LeagueRow {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	gender: string | null;
	skillLevel: string | null;
	regStartDate: string | null;
	regEndDate: string | null;
	seasonStartDate: string | null;
	seasonEndDate: string | null;
	isLocked: boolean;
	isActive: boolean;
	divisionCount: number;
}

const normalizeSeasonName = (value: string | null | undefined): string =>
	value?.trim().toLowerCase() ?? '';

const formatLegacySeasonLabel = (league: League): string => {
	const season = league.season?.trim() ?? '';
	const year = league.year ?? null;
	if (season && year) return `${season} ${year}`;
	if (season) return season;
	if (year) return `${year}`;
	return '';
};

const leagueMatchesSeason = (league: League, season: Season): boolean => {
	if (league.seasonId) {
		return league.seasonId === season.id;
	}

	return normalizeSeasonName(formatLegacySeasonLabel(league)) === normalizeSeasonName(season.name);
};

async function resolveOfferingForSeason(
	dbOps: Awaited<ReturnType<typeof getTenantDbOps>>,
	clientId: string,
	season: Season,
	offeringSlug: string
): Promise<Offering | null> {
	const directMatch = await dbOps.offerings.getByClientIdSeasonIdAndSlug(
		clientId,
		season.id,
		offeringSlug
	);
	if (directMatch?.id) return directMatch;

	const [offerings, leagues] = await Promise.all([
		dbOps.offerings.getByClientId(clientId),
		dbOps.leagues.getByClientId(clientId)
	]);

	const slugMatches = offerings.filter((offering) => offering.slug?.trim() === offeringSlug);
	if (slugMatches.length === 0) return null;

	return (
		slugMatches.find((offering) => offering.seasonId === season.id) ??
		slugMatches.find((offering) =>
			leagues.some(
				(league) => league.offeringId === offering.id && leagueMatchesSeason(league, season)
			)
		) ??
		slugMatches[0] ??
		null
	);
}

export const load: PageServerLoad = async (event) => {
	const { platform, locals, params } = event;
	if (!platform?.env?.DB) {
		return {
			season: null,
			offering: null,
			leagues: [] as LeagueRow[],
			summary: {
				leagueCount: 0,
				divisionCount: 0,
				openCount: 0,
				closedCount: 0
			},
			error: 'Database not configured.'
		};
	}

	const clientId = requireAuthenticatedClientId(locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const season = await dbOps.seasons.getByClientIdAndSlug(clientId, params.seasonSlug);
		if (!season?.id) {
			throw error(404, 'Season not found.');
		}

		const offering = await resolveOfferingForSeason(
			dbOps,
			clientId,
			season,
			params.offeringSlug
		);
		if (!offering?.id) {
			throw error(404, 'Offering not found.');
		}

		const leagues = (await dbOps.leagues.getByClientId(clientId)).filter(
			(league) => league.offeringId === offering.id && leagueMatchesSeason(league, season)
		);
		const leagueIds = leagues
			.map((league) => league.id)
			.filter((leagueId): leagueId is string => Boolean(leagueId));
		const divisions = await dbOps.divisions.getByLeagueIds(leagueIds);
		const divisionCountByLeagueId = new Map<string, number>();
		for (const division of divisions) {
			if (!division.leagueId) continue;
			divisionCountByLeagueId.set(
				division.leagueId,
				(divisionCountByLeagueId.get(division.leagueId) ?? 0) + 1
			);
		}

		const leagueRows = leagues
			.filter((league): league is League & { id: string } => Boolean(league.id))
			.map<LeagueRow>((league) => ({
				id: league.id,
				name: league.name?.trim() || 'Untitled League',
				slug: league.slug?.trim() || '',
				description: league.description?.trim() || null,
				gender: league.gender?.trim() || null,
				skillLevel: league.skillLevel?.trim() || null,
				regStartDate: league.regStartDate ?? null,
				regEndDate: league.regEndDate ?? null,
				seasonStartDate: league.seasonStartDate ?? null,
				seasonEndDate: league.seasonEndDate ?? null,
				isLocked: league.isLocked === 1,
				isActive: league.isActive !== 0,
				divisionCount: divisionCountByLeagueId.get(league.id) ?? 0
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		const now = Date.now();
		const isOpenLeague = (league: LeagueRow): boolean => {
			if (!league.isActive || league.isLocked) return false;
			if (!league.regStartDate || !league.regEndDate) return false;
			const start = Date.parse(league.regStartDate);
			const end = Date.parse(league.regEndDate);
			if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
			return start <= now && end >= now;
		};

		return {
			season: {
				id: season.id ?? '',
				name: season.name?.trim() || 'Season',
				slug: season.slug?.trim() || '',
				startDate: season.startDate ?? null,
				endDate: season.endDate ?? null,
				isCurrent: season.isCurrent === 1
			},
			offering: {
				id: offering.id ?? '',
				name: offering.name?.trim() || 'Offering',
				slug: offering.slug?.trim() || '',
				sport: offering.sport?.trim() || null,
				type: offering.type?.trim() || 'league',
				description: offering.description?.trim() || null,
				minPlayers: offering.minPlayers ?? null,
				maxPlayers: offering.maxPlayers ?? null,
				rulebookUrl: offering.rulebookUrl?.trim() || null
			},
			leagues: leagueRows,
			summary: {
				leagueCount: leagueRows.length,
				divisionCount: leagueRows.reduce((sum, league) => sum + league.divisionCount, 0),
				openCount: leagueRows.filter(isOpenLeague).length,
				closedCount: leagueRows.filter((league) => !isOpenLeague(league)).length
			}
		};
	} catch (err) {
		if ((err as { status?: number })?.status === 404) {
			throw err;
		}

		console.error('Failed to load offering detail page:', err);
		return {
			season: null,
			offering: null,
			leagues: [] as LeagueRow[],
			summary: {
				leagueCount: 0,
				divisionCount: 0,
				openCount: 0,
				closedCount: 0
			},
			error: 'Unable to load offering details right now.'
		};
	}
};
