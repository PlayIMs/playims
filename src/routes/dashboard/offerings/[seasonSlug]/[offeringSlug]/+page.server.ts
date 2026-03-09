import { error } from '@sveltejs/kit';
import type { League } from '$lib/database';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	leagueMatchesSeason,
	resolveOfferingForSeason
} from '$lib/server/intramural-offering-scope';
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
	teamCount: number;
	waitlistCount: number;
	divisions: DivisionRow[];
}

interface DivisionRow {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	dayOfWeek: string | null;
	gameTime: string | null;
	location: string | null;
	startDate: string | null;
	maxTeams: number | null;
	isLocked: boolean;
	teamCount: number;
	waitlistCount: number;
}

const isActiveTeamStatus = (value: string | null | undefined): boolean =>
	(value?.trim().toLowerCase() ?? '') === 'active';

const isWaitlistTeamStatus = (value: string | null | undefined): boolean => {
	const normalized = value?.trim().toLowerCase() ?? '';
	return normalized === 'waitlist' || normalized === 'waitlisted';
};

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

		const offering = await resolveOfferingForSeason(dbOps, clientId, season, params.offeringSlug);
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
		const divisionIds = divisions
			.map((division) => division.id)
			.filter((divisionId): divisionId is string => Boolean(divisionId));
		const teams = await dbOps.teams.getByClientIdAndDivisionIds(clientId, divisionIds);

		const activeTeamCountByDivisionId = new Map<string, number>();
		const waitlistCountByDivisionId = new Map<string, number>();
		for (const team of teams) {
			const divisionId = team.divisionId?.trim();
			if (!divisionId) continue;
			if (isWaitlistTeamStatus(team.teamStatus)) {
				waitlistCountByDivisionId.set(
					divisionId,
					(waitlistCountByDivisionId.get(divisionId) ?? 0) + 1
				);
				continue;
			}
			if (!isActiveTeamStatus(team.teamStatus)) continue;
			activeTeamCountByDivisionId.set(
				divisionId,
				(activeTeamCountByDivisionId.get(divisionId) ?? 0) + 1
			);
		}

		const divisionsByLeagueId = new Map<string, DivisionRow[]>();
		for (const division of divisions) {
			const leagueId = division.leagueId?.trim();
			const divisionId = division.id?.trim();
			if (!leagueId || !divisionId) continue;

			const divisionRow: DivisionRow = {
				id: divisionId,
				name: division.name?.trim() || 'Untitled Division',
				slug: division.slug?.trim() || '',
				description: division.description?.trim() || null,
				dayOfWeek: division.dayOfWeek?.trim() || null,
				gameTime: division.gameTime?.trim() || null,
				location: division.location?.trim() || null,
				startDate: division.startDate ?? null,
				maxTeams: division.maxTeams ?? null,
				isLocked: division.isLocked === 1,
				teamCount: activeTeamCountByDivisionId.get(divisionId) ?? 0,
				waitlistCount: waitlistCountByDivisionId.get(divisionId) ?? 0
			};

			if (!divisionsByLeagueId.has(leagueId)) {
				divisionsByLeagueId.set(leagueId, []);
			}
			divisionsByLeagueId.get(leagueId)?.push(divisionRow);
		}

		const leagueRows = leagues
			.filter((league): league is League & { id: string } => Boolean(league.id))
			.map<LeagueRow>((league) => {
				const leagueDivisions = [...(divisionsByLeagueId.get(league.id) ?? [])].sort((a, b) =>
					a.name.localeCompare(b.name)
				);

				return {
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
					divisionCount: leagueDivisions.length,
					teamCount: leagueDivisions.reduce((sum, division) => sum + division.teamCount, 0),
					waitlistCount: leagueDivisions.reduce((sum, division) => sum + division.waitlistCount, 0),
					divisions: leagueDivisions
				};
			})
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
