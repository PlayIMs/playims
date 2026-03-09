import { error } from '@sveltejs/kit';
import type { League } from '$lib/database';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	leagueMatchesSeason,
	resolveLeagueForOffering,
	resolveOfferingForSeason
} from '$lib/server/intramural-offering-scope';
import type { PageServerLoad } from './$types';

type TeamPlacement = 'active' | 'waitlist';

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
	lastUpdatedAt: string | null;
}

interface DivisionTeamRow {
	id: string;
	name: string;
	slug: string;
	status: TeamPlacement;
	rosterSize: number;
	captainName: string | null;
	dateRegistered: string | null;
	description: string | null;
	teamColor: string | null;
}

interface DivisionSection {
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
	standings: StandingsRow[];
	teams: DivisionTeamRow[];
}

interface WaitlistTeamRow {
	id: string;
	name: string;
	slug: string;
	preferredDivisionId: string;
	preferredDivisionName: string;
	rosterSize: number;
	captainName: string | null;
	dateRegistered: string | null;
	description: string | null;
}

interface OfferingLeagueRow {
	id: string;
	name: string;
	slug: string;
	isLocked: boolean;
}

const isActiveTeamStatus = (value: string | null | undefined): boolean =>
	(value?.trim().toLowerCase() ?? '') === 'active';

const isWaitlistTeamStatus = (value: string | null | undefined): boolean => {
	const normalized = value?.trim().toLowerCase() ?? '';
	return normalized === 'waitlist' || normalized === 'waitlisted';
};

const safeNumber = (value: number | null | undefined): number =>
	typeof value === 'number' ? value : 0;

const parseWinPctValue = (value: string | null | undefined): number => {
	if (!value) return Number.NEGATIVE_INFINITY;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const parseTimestamp = (value: string | null | undefined): number => {
	if (!value) return Number.NEGATIVE_INFINITY;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const formatUserDisplayName = (user: {
	firstName?: string | null;
	lastName?: string | null;
	email?: string | null;
}): string => {
	const fullName = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(' ').trim();
	if (fullName.length > 0) return fullName;
	const email = user.email?.trim();
	if (email) return email;
	return 'Unknown Captain';
};

export const load: PageServerLoad = async (event) => {
	const { platform, locals, params } = event;
	if (!platform?.env?.DB) {
		return {
			league: null,
			leagues: [] as OfferingLeagueRow[],
			offering: null,
			season: null,
			divisions: [] as DivisionSection[],
			waitlistTeams: [] as WaitlistTeamRow[],
			summary: {
				divisionCount: 0,
				activeTeamCount: 0,
				waitlistCount: 0,
				lockedDivisionCount: 0
			},
			error: 'Database not configured'
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

		const league = await resolveLeagueForOffering(
			dbOps,
			clientId,
			season,
			offering,
			params.leagueSlug
		);
		if (!league?.id) {
			throw error(404, 'League not found.');
		}

		const [divisions, standings, allLeagues] = await Promise.all([
			dbOps.divisions.getByLeagueId(league.id),
			dbOps.divisionStandings.getByClientIdAndLeagueId(clientId, league.id),
			dbOps.leagues.getByClientId(clientId)
		]);

		const offeringLeagues = allLeagues
			.filter(
				(candidateLeague): candidateLeague is League & { id: string } =>
					Boolean(candidateLeague.id) &&
					candidateLeague.offeringId === offering.id &&
					leagueMatchesSeason(candidateLeague, season)
			)
			.map<OfferingLeagueRow>((candidateLeague) => ({
				id: candidateLeague.id,
				name: candidateLeague.name?.trim() || 'Untitled League',
				slug: candidateLeague.slug?.trim() || '',
				isLocked: candidateLeague.isLocked === 1
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		const divisionIds = divisions
			.map((division) => division.id)
			.filter((divisionId): divisionId is string => Boolean(divisionId));
		const teams = await dbOps.teams.getByClientIdAndDivisionIds(clientId, divisionIds);
		const teamIds = teams
			.map((team) => team.id)
			.filter((teamId): teamId is string => Boolean(teamId));
		const rosters = await dbOps.rosters.getByClientIdAndTeamIds(clientId, teamIds);

		const activeRosters = rosters.filter((roster) => !roster.dateLeft);
		const rosterCountByTeamId = new Map<string, number>();
		for (const roster of activeRosters) {
			if (!roster.teamId) continue;
			rosterCountByTeamId.set(roster.teamId, (rosterCountByTeamId.get(roster.teamId) ?? 0) + 1);
		}

		const clientUsers = await dbOps.users.getByClientId(clientId);
		const usersById = new Map(
			clientUsers
				.filter(
					(
						user
					): user is {
						id: string;
						firstName?: string | null;
						lastName?: string | null;
						email?: string | null;
					} => Boolean(user?.id)
				)
				.map((user) => [user.id, user])
		);
		const captainNameByTeamId = new Map<string, string>();
		for (const roster of activeRosters) {
			if (!roster.teamId || roster.isCaptain !== 1 || captainNameByTeamId.has(roster.teamId))
				continue;
			const captain = usersById.get(roster.userId);
			captainNameByTeamId.set(
				roster.teamId,
				captain ? formatUserDisplayName(captain) : 'Unknown Captain'
			);
		}

		const teamsById = new Map(
			teams
				.filter((team): team is typeof team & { id: string } => Boolean(team.id))
				.map((team) => [team.id, team])
		);
		const standingsByDivisionId = new Map<string, StandingsRow[]>();
		for (const standing of standings) {
			if (!standing.divisionId || !standing.teamId) continue;
			const team = teamsById.get(standing.teamId);
			const entry: StandingsRow = {
				teamId: standing.teamId,
				teamName: team?.name?.trim() || 'Unknown Team',
				wins: safeNumber(standing.wins),
				losses: safeNumber(standing.losses),
				ties: safeNumber(standing.ties),
				points: safeNumber(standing.points),
				pointsFor: safeNumber(standing.pointsFor),
				pointsAgainst: safeNumber(standing.pointsAgainst),
				winPct: standing.winPct?.trim() || '.000',
				streak: standing.streak?.trim() || '--',
				lastUpdatedAt: standing.lastUpdatedAt ?? null
			};
			if (!standingsByDivisionId.has(standing.divisionId)) {
				standingsByDivisionId.set(standing.divisionId, []);
			}
			standingsByDivisionId.get(standing.divisionId)?.push(entry);
		}

		for (const rows of standingsByDivisionId.values()) {
			rows.sort((a, b) => {
				if (b.points !== a.points) return b.points - a.points;
				const winPctDiff = parseWinPctValue(b.winPct) - parseWinPctValue(a.winPct);
				if (winPctDiff !== 0) return winPctDiff;
				if (b.wins !== a.wins) return b.wins - a.wins;
				const differentialA = a.pointsFor - a.pointsAgainst;
				const differentialB = b.pointsFor - b.pointsAgainst;
				if (differentialB !== differentialA) return differentialB - differentialA;
				return a.teamName.localeCompare(b.teamName);
			});
		}

		const divisionsData: DivisionSection[] = divisions
			.filter((division): division is (typeof divisions)[number] & { id: string } =>
				Boolean(division.id)
			)
			.map((division) => {
				const activeTeams = teams
					.filter((team) => team.divisionId === division.id && isActiveTeamStatus(team.teamStatus))
					.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
					.map<DivisionTeamRow>((team) => ({
						id: team.id,
						name: team.name?.trim() || 'Unnamed Team',
						slug: team.slug?.trim() || '',
						status: 'active',
						rosterSize: rosterCountByTeamId.get(team.id) ?? team.currentRosterSize ?? 0,
						captainName: captainNameByTeamId.get(team.id) ?? null,
						dateRegistered: team.dateRegistered ?? null,
						description: team.description?.trim() || null,
						teamColor: team.teamColor?.trim() || null
					}));
				const waitlistCount = teams.filter(
					(team) => team.divisionId === division.id && isWaitlistTeamStatus(team.teamStatus)
				).length;

				return {
					id: division.id,
					name: division.name?.trim() || 'Untitled Division',
					slug: division.slug?.trim() || '',
					description: division.description?.trim() || null,
					dayOfWeek: division.dayOfWeek?.trim() || null,
					gameTime: division.gameTime?.trim() || null,
					location: division.location?.trim() || null,
					startDate: division.startDate ?? null,
					maxTeams: division.maxTeams ?? null,
					isLocked: division.isLocked === 1,
					teamCount: activeTeams.length,
					waitlistCount,
					standings: standingsByDivisionId.get(division.id) ?? [],
					teams: activeTeams
				} satisfies DivisionSection;
			})
			.sort((a, b) => a.name.localeCompare(b.name));

		const divisionNameById = new Map(divisionsData.map((division) => [division.id, division.name]));
		const waitlistTeams = teams
			.filter((team): team is (typeof teams)[number] & { id: string } => Boolean(team.id))
			.filter((team) => isWaitlistTeamStatus(team.teamStatus))
			.map<WaitlistTeamRow>((team) => ({
				id: team.id,
				name: team.name?.trim() || 'Unnamed Team',
				slug: team.slug?.trim() || '',
				preferredDivisionId: team.divisionId,
				preferredDivisionName: divisionNameById.get(team.divisionId) ?? 'Unassigned Division',
				rosterSize: rosterCountByTeamId.get(team.id) ?? team.currentRosterSize ?? 0,
				captainName: captainNameByTeamId.get(team.id) ?? null,
				dateRegistered: team.dateRegistered ?? null,
				description: team.description?.trim() || null
			}))
			.sort((a, b) => {
				const dateDiff = parseTimestamp(a.dateRegistered) - parseTimestamp(b.dateRegistered);
				if (dateDiff !== 0) return dateDiff;
				return a.name.localeCompare(b.name);
			});

		return {
			league: {
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
				hasPreseason: league.hasPreseason === 1,
				preseasonStartDate: league.preseasonStartDate ?? null,
				preseasonEndDate: league.preseasonEndDate ?? null,
				hasPostseason: league.hasPostseason === 1,
				postseasonStartDate: league.postseasonStartDate ?? null,
				postseasonEndDate: league.postseasonEndDate ?? null,
				isLocked: league.isLocked === 1,
				imageUrl: league.imageUrl ?? null
			},
			leagues: offeringLeagues,
			offering: offering
				? {
						id: offering.id ?? '',
						name: offering.name?.trim() || 'Offering',
						slug: offering.slug?.trim() || '',
						sport: offering.sport?.trim() || null,
						type: offering.type?.trim() || 'league',
						description: offering.description?.trim() || null,
						minPlayers: offering.minPlayers ?? null,
						maxPlayers: offering.maxPlayers ?? null,
						rulebookUrl: offering.rulebookUrl?.trim() || null
					}
				: null,
			season: season
				? {
						id: season.id ?? '',
						name: season.name?.trim() || 'Season',
						slug: season.slug?.trim() || '',
						startDate: season.startDate ?? null,
						endDate: season.endDate ?? null,
						isCurrent: season.isCurrent === 1
					}
				: null,
			divisions: divisionsData,
			waitlistTeams,
			summary: {
				divisionCount: divisionsData.length,
				activeTeamCount: divisionsData.reduce((sum, division) => sum + division.teamCount, 0),
				waitlistCount: waitlistTeams.length,
				lockedDivisionCount: divisionsData.filter((division) => division.isLocked).length
			}
		};
	} catch (err) {
		if ((err as { status?: number })?.status === 404) {
			throw err;
		}

		console.error('Failed to load league offerings detail page:', err);
		return {
			league: null,
			leagues: [] as OfferingLeagueRow[],
			offering: null,
			season: null,
			divisions: [] as DivisionSection[],
			waitlistTeams: [] as WaitlistTeamRow[],
			summary: {
				divisionCount: 0,
				activeTeamCount: 0,
				waitlistCount: 0,
				lockedDivisionCount: 0
			},
			error: 'Unable to load league details right now.'
		};
	}
};
