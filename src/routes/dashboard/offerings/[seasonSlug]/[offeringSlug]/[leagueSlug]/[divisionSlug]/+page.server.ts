import { error } from '@sveltejs/kit';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	resolveLeagueForOffering,
	resolveOfferingForSeason
} from '$lib/server/intramural-offering-scope';
import type { PageServerLoad } from './$types';

interface StandingsRow {
	teamId: string;
	teamName: string;
	wins: number;
	losses: number;
	ties: number;
	points: number;
	pointsFor: number;
	pointsAgainst: number;
	winPct: string;
	streak: string;
}

interface TeamRow {
	id: string;
	name: string;
	slug: string;
	status: 'active' | 'waitlist';
	rosterSize: number;
	dateRegistered: string | null;
	description: string | null;
}

const isActiveTeamStatus = (value: string | null | undefined): boolean =>
	(value?.trim().toLowerCase() ?? '') === 'active';

const isWaitlistTeamStatus = (value: string | null | undefined): boolean => {
	const normalized = value?.trim().toLowerCase() ?? '';
	return normalized === 'waitlist' || normalized === 'waitlisted';
};

const safeNumber = (value: number | null | undefined): number =>
	typeof value === 'number' ? value : 0;

export const load: PageServerLoad = async (event) => {
	const { platform, locals, params } = event;
	if (!platform?.env?.DB) {
		return {
			season: null,
			offering: null,
			league: null,
			division: null,
			teams: [] as TeamRow[],
			waitlistTeams: [] as TeamRow[],
			standings: [] as StandingsRow[],
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

		const league = await resolveLeagueForOffering(
			dbOps,
			clientId,
			season,
			offering,
			params.leagueSlug
		);
		if (!league?.id || league.offeringId !== offering.id) {
			throw error(404, 'League not found.');
		}

		const division = await dbOps.divisions.getByLeagueIdAndSlug(league.id, params.divisionSlug);
		if (!division?.id) {
			throw error(404, 'Division not found.');
		}

		const rawTeams = await dbOps.teams.getByClientIdAndDivisionIds(clientId, [division.id]);
		const teams = rawTeams.filter((team): team is (typeof rawTeams)[number] & { id: string } =>
			Boolean(team.id)
		);
		const rosters = await dbOps.rosters.getByClientIdAndTeamIds(
			clientId,
			teams.map((team) => team.id)
		);
		const standingsRaw = await dbOps.divisionStandings.getByClientIdAndLeagueId(
			clientId,
			league.id
		);

		const activeRosterCountByTeamId = new Map<string, number>();
		for (const roster of rosters) {
			if (!roster.teamId || roster.dateLeft) continue;
			activeRosterCountByTeamId.set(
				roster.teamId,
				(activeRosterCountByTeamId.get(roster.teamId) ?? 0) + 1
			);
		}

		const standings = standingsRaw
			.filter((row) => row.divisionId === division.id && row.teamId)
			.map<StandingsRow>((row) => ({
				teamId: row.teamId!,
				teamName: teams.find((team) => team.id === row.teamId)?.name?.trim() || 'Unknown Team',
				wins: safeNumber(row.wins),
				losses: safeNumber(row.losses),
				ties: safeNumber(row.ties),
				points: safeNumber(row.points),
				pointsFor: safeNumber(row.pointsFor),
				pointsAgainst: safeNumber(row.pointsAgainst),
				winPct: row.winPct?.trim() || '.000',
				streak: row.streak?.trim() || '--'
			}))
			.sort((a, b) => b.points - a.points || a.teamName.localeCompare(b.teamName));

		const teamRows = teams
			.filter((team) => isActiveTeamStatus(team.teamStatus))
			.map<TeamRow>((team) => ({
				id: team.id,
				name: team.name?.trim() || 'Unnamed Team',
				slug: team.slug?.trim() || '',
				status: 'active',
				rosterSize: activeRosterCountByTeamId.get(team.id) ?? team.currentRosterSize ?? 0,
				dateRegistered: team.dateRegistered ?? null,
				description: team.description?.trim() || null
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		const waitlistTeams = teams
			.filter((team) => isWaitlistTeamStatus(team.teamStatus))
			.map<TeamRow>((team) => ({
				id: team.id,
				name: team.name?.trim() || 'Unnamed Team',
				slug: team.slug?.trim() || '',
				status: 'waitlist',
				rosterSize: activeRosterCountByTeamId.get(team.id) ?? team.currentRosterSize ?? 0,
				dateRegistered: team.dateRegistered ?? null,
				description: team.description?.trim() || null
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		return {
			season: {
				id: season.id ?? '',
				name: season.name?.trim() || 'Season',
				slug: season.slug?.trim() || ''
			},
			offering: {
				id: offering.id ?? '',
				name: offering.name?.trim() || 'Offering',
				slug: offering.slug?.trim() || '',
				sport: offering.sport?.trim() || null,
				description: offering.description?.trim() || null,
				rulebookUrl: offering.rulebookUrl?.trim() || null
			},
			league: {
				id: league.id,
				name: league.name?.trim() || 'League',
				slug: league.slug?.trim() || '',
				description: league.description?.trim() || null
			},
			division: {
				id: division.id,
				name: division.name?.trim() || 'Division',
				slug: division.slug?.trim() || '',
				description: division.description?.trim() || null,
				dayOfWeek: division.dayOfWeek?.trim() || null,
				gameTime: division.gameTime?.trim() || null,
				location: division.location?.trim() || null,
				startDate: division.startDate ?? null,
				maxTeams: division.maxTeams ?? null,
				isLocked: division.isLocked === 1
			},
			teams: teamRows,
			waitlistTeams,
			standings
		};
	} catch (err) {
		if ((err as { status?: number })?.status === 404) {
			throw err;
		}

		console.error('Failed to load division detail page:', err);
		return {
			season: null,
			offering: null,
			league: null,
			division: null,
			teams: [] as TeamRow[],
			waitlistTeams: [] as TeamRow[],
			standings: [] as StandingsRow[],
			error: 'Unable to load division details right now.'
		};
	}
};
