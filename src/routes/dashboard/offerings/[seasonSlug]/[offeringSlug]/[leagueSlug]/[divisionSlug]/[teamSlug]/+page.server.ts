import { error, redirect } from '@sveltejs/kit';
import type { League } from '$lib/database';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	buildSeasonScopedOfferingOptions,
	resolveLeagueForOffering,
	resolveOfferingForSeason
} from '$lib/server/intramural-offering-scope';
import { compareByDayOfWeekAndTime } from '$lib/utils/schedule-sort.js';
import type { PageServerLoad } from './$types';

interface NavigationOption {
	label: string;
	href: string;
}

interface StandingsRow {
	rank: number;
	teamId: string;
	teamName: string;
	wins: number | null;
	losses: number | null;
	ties: number | null;
	points: number | null;
	winPct: string | null;
	streak: string | null;
	sportsmanshipRating: string | null;
	forfeits: number | null;
	forgoes: number | null;
}

interface RosterRow {
	id: string;
	userId: string;
	displayName: string;
	email: string | null;
	roleLabel: string;
	rosterStatus: string;
	dateJoined: string | null;
}

interface ScheduleRow {
	id: string;
	scheduledStartAt: string | null;
	scheduledEndAt: string | null;
	opponentName: string;
	isHome: boolean;
	location: string;
	status: string;
	weekLabel: string | null;
	resultLabel: string;
}

const safeNumber = (value: number | null | undefined): number | null =>
	typeof value === 'number' ? value : null;

const parseWinPctValue = (value: string | null | undefined): number => {
	if (!value) return Number.NEGATIVE_INFINITY;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const parseTimestamp = (value: string | null | undefined): number => {
	if (!value) return Number.POSITIVE_INFINITY;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const normalizeStatus = (value: string | null | undefined): string => {
	const trimmed = value?.trim();
	if (!trimmed) return 'Scheduled';
	return trimmed
		.toLowerCase()
		.replace(/[_-]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
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
	return 'Unknown Player';
};

const resolveRosterRoleLabel = (isCaptain: number | null | undefined, isCoCaptain: number | null | undefined) => {
	if (isCaptain === 1) return 'Captain';
	if (isCoCaptain === 1) return 'Co-Captain';
	return 'Player';
};

const computeResultLabel = (
	homeTeamId: string | null | undefined,
	awayTeamId: string | null | undefined,
	homeScore: number | null | undefined,
	awayScore: number | null | undefined,
	teamId: string
): string => {
	if (typeof homeScore !== 'number' || typeof awayScore !== 'number') return 'TBD';
	const isHome = homeTeamId === teamId;
	const teamScore = isHome ? homeScore : awayScore;
	const opponentScore = isHome ? awayScore : homeScore;
	const outcome = teamScore === opponentScore ? 'T' : teamScore > opponentScore ? 'W' : 'L';
	return `${outcome} ${teamScore}-${opponentScore}`;
};

export const load: PageServerLoad = async (event) => {
	const { platform, locals, params } = event;
	if (!platform?.env?.DB) {
		return {
			season: null,
			offering: null,
			league: null,
			division: null,
			team: null,
			offeringOptions: [] as NavigationOption[],
			leagueOptions: [] as NavigationOption[],
			divisionOptions: [] as NavigationOption[],
			teamOptions: [] as NavigationOption[],
			standings: [] as StandingsRow[],
			roster: [] as RosterRow[],
			schedule: [] as ScheduleRow[],
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

		const [allOfferings, allLeagues, divisions] = await Promise.all([
			dbOps.offerings.getByClientId(clientId),
			dbOps.leagues.getByClientId(clientId),
			dbOps.divisions.getByLeagueId(league.id)
		]);
		const division =
			divisions.find(
				(candidate) =>
					(candidate.slug?.trim() || candidate.id?.trim() || '') === params.divisionSlug
			) ?? null;
		if (!division?.id) {
			throw error(404, 'Division not found.');
		}

		const rawDivisionTeams = await dbOps.teams.getByClientIdAndDivisionIds(clientId, [division.id]);
		const allDivisionTeams = rawDivisionTeams.filter(
			(candidate): candidate is (typeof rawDivisionTeams)[number] & { id: string } => Boolean(candidate.id)
		);
		const team =
			allDivisionTeams.find(
				(candidate) =>
					(candidate.slug?.trim() || candidate.id?.trim() || '') === params.teamSlug
			) ?? null;
		if (!team?.id) {
			throw error(404, 'Team not found.');
		}

		const [rosters, users, standingsRaw, events, facilities, facilityAreas] = await Promise.all([
			dbOps.rosters.getByClientIdAndTeamIds(clientId, [team.id]),
			dbOps.users.getByClientId(clientId),
			dbOps.divisionStandings.getByClientIdAndLeagueId(clientId, league.id),
			dbOps.events.getByClientId(clientId),
			dbOps.facilities.getAll(clientId),
			dbOps.facilityAreas.getAll(clientId)
		]);

		const usersById = new Map(
			users
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
		const facilitiesById = new Map(
			facilities
				.filter((facility): facility is (typeof facilities)[number] & { id: string } =>
					Boolean(facility.id)
				)
				.map((facility) => [facility.id, facility])
		);
		const facilityAreasById = new Map(
			facilityAreas
				.filter((area): area is (typeof facilityAreas)[number] & { id: string } => Boolean(area.id))
				.map((area) => [area.id, area])
		);
		const teamsById = new Map(allDivisionTeams.map((candidate) => [candidate.id, candidate]));

		const roster = rosters
			.filter((row) => !row.dateLeft)
			.map<RosterRow>((row) => {
				const player = usersById.get(row.userId);
				return {
					id: row.id,
					userId: row.userId,
					displayName: player ? formatUserDisplayName(player) : 'Unknown Player',
					email: player?.email?.trim() || null,
					roleLabel: resolveRosterRoleLabel(row.isCaptain, row.isCoCaptain),
					rosterStatus: normalizeStatus(row.rosterStatus),
					dateJoined: row.dateJoined ?? row.createdAt ?? null
				};
			})
			.sort((a, b) => {
				const roleRank = (roleLabel: string) =>
					roleLabel === 'Captain' ? 0 : roleLabel === 'Co-Captain' ? 1 : 2;
				const roleDifference = roleRank(a.roleLabel) - roleRank(b.roleLabel);
				if (roleDifference !== 0) return roleDifference;
				return a.displayName.localeCompare(b.displayName);
			});

		const standings = allDivisionTeams
			.map((candidate) => {
				const standing = standingsRaw.find(
					(row) => row.divisionId === division.id && row.teamId === candidate.id
				);
				return {
					rank: 0,
					teamId: candidate.id,
					teamName: candidate.name?.trim() || 'Unnamed Team',
					wins: safeNumber(standing?.wins),
					losses: safeNumber(standing?.losses),
					ties: safeNumber(standing?.ties),
					points: safeNumber(standing?.points),
					winPct: standing?.winPct?.trim() || null,
					streak: standing?.streak?.trim() || null,
					sportsmanshipRating: null,
					forfeits: null,
					forgoes: null
				} satisfies StandingsRow;
			})
			.sort((a, b) => {
				if ((b.points ?? Number.NEGATIVE_INFINITY) !== (a.points ?? Number.NEGATIVE_INFINITY)) {
					return (b.points ?? Number.NEGATIVE_INFINITY) - (a.points ?? Number.NEGATIVE_INFINITY);
				}
				const winPctDiff = parseWinPctValue(b.winPct) - parseWinPctValue(a.winPct);
				if (winPctDiff !== 0) return winPctDiff;
				if ((b.wins ?? Number.NEGATIVE_INFINITY) !== (a.wins ?? Number.NEGATIVE_INFINITY)) {
					return (b.wins ?? Number.NEGATIVE_INFINITY) - (a.wins ?? Number.NEGATIVE_INFINITY);
				}
				return a.teamName.localeCompare(b.teamName);
			})
			.map((row, index) => ({
				...row,
				rank: index + 1
			}));

		const schedule = events
			.filter(
				(row) =>
					row.divisionId === division.id &&
					(row.homeTeamId === team.id || row.awayTeamId === team.id)
			)
			.map<ScheduleRow>((row) => {
				const isHome = row.homeTeamId === team.id;
				const opponentTeamId = isHome ? row.awayTeamId : row.homeTeamId;
				const opponent = opponentTeamId ? teamsById.get(opponentTeamId) : null;
				const area = row.facilityAreaId ? facilityAreasById.get(row.facilityAreaId) : null;
				const facility =
					(area?.facilityId ? facilitiesById.get(area.facilityId) : null) ||
					(row.facilityId ? facilitiesById.get(row.facilityId) : null);
				const locationParts = [facility?.name?.trim(), area?.name?.trim()].filter(Boolean);
				return {
					id: row.id,
					scheduledStartAt: row.scheduledStartAt ?? null,
					scheduledEndAt: row.scheduledEndAt ?? null,
					opponentName: opponent?.name?.trim() || 'TBD',
					isHome,
					location: locationParts.length > 0 ? locationParts.join(' - ') : 'TBD',
					status: normalizeStatus(row.status),
					weekLabel: typeof row.weekNumber === 'number' ? `Week ${row.weekNumber}` : null,
					resultLabel: computeResultLabel(
						row.homeTeamId,
						row.awayTeamId,
						row.homeScore,
						row.awayScore,
						team.id
					)
				};
			})
			.sort((a, b) => parseTimestamp(a.scheduledStartAt) - parseTimestamp(b.scheduledStartAt));

		const offeringOptions = buildSeasonScopedOfferingOptions({
			season,
			offerings: allOfferings,
			leagues: allLeagues
		});
		const leagueOptions = allLeagues
			.filter(
				(candidate): candidate is League & { id: string } =>
					Boolean(candidate.id) && candidate.offeringId === offering.id
			)
			.filter(
				(candidate) =>
					candidate.seasonId?.trim() === season.id || candidate.season?.trim() === season.name?.trim()
			)
			.map<NavigationOption>((candidate) => ({
				label: candidate.name?.trim() || 'League',
				href: `/dashboard/offerings/${season.slug?.trim() || params.seasonSlug}/${offering.slug?.trim() || params.offeringSlug}/${candidate.slug?.trim() || candidate.id}`
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
		const divisionOptions = divisions
			.filter((candidate): candidate is (typeof divisions)[number] & { id: string } => Boolean(candidate.id))
			.sort((a, b) =>
				compareByDayOfWeekAndTime(
					{
						dayOfWeek: a.dayOfWeek,
						gameTime: a.gameTime,
						name: a.name
					},
					{
						dayOfWeek: b.dayOfWeek,
						gameTime: b.gameTime,
						name: b.name
					}
				)
			)
			.map<NavigationOption>((candidate) => ({
				label: candidate.name?.trim() || 'Division',
				href: `/dashboard/offerings/${season.slug?.trim() || params.seasonSlug}/${offering.slug?.trim() || params.offeringSlug}/${league.slug?.trim() || params.leagueSlug}/${candidate.slug?.trim() || candidate.id}`
			}));
		const teamOptions = allDivisionTeams
			.map<NavigationOption>((candidate) => ({
				label: candidate.name?.trim() || 'Team',
				href: `/dashboard/offerings/${season.slug?.trim() || params.seasonSlug}/${offering.slug?.trim() || params.offeringSlug}/${league.slug?.trim() || params.leagueSlug}/${division.slug?.trim() || params.divisionSlug}/${candidate.slug?.trim() || candidate.id}`
			}))
			.sort((a, b) => a.label.localeCompare(b.label));

		return {
			season: {
				id: season.id ?? '',
				name: season.name?.trim() || 'Season',
				slug: season.slug?.trim() || '',
				isCurrent: season.isCurrent === 1
			},
			offering: {
				id: offering.id ?? '',
				name: offering.name?.trim() || 'Offering',
				slug: offering.slug?.trim() || '',
				sport: offering.sport?.trim() || null,
				description: offering.description?.trim() || null,
				maxPlayers: offering.maxPlayers ?? null
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
				startDate: division.startDate ?? null
			},
			team: {
				id: team.id,
				name: team.name?.trim() || 'Team',
				slug: team.slug?.trim() || '',
				description: team.description?.trim() || null,
				teamColor: team.teamColor?.trim() || null,
				teamStatus: normalizeStatus(team.teamStatus),
				doesAcceptFreeAgents: team.doesAcceptFreeAgents === 1,
				isAutoAcceptMembers: team.isAutoAcceptMembers === 1,
				dateRegistered: team.dateRegistered ?? null,
				dateJoinedDivision: team.dateJoinedDivision ?? null,
				createdAt: team.createdAt ?? null
			},
			offeringOptions,
			leagueOptions,
			divisionOptions,
			teamOptions,
			standings,
			roster,
			schedule
		};
	} catch (err) {
		if ((err as { status?: number })?.status === 404) {
			throw redirect(302, '/dashboard/offerings');
		}

		console.error('Failed to load team detail page:', err);
		return {
			season: null,
			offering: null,
			league: null,
			division: null,
			team: null,
			offeringOptions: [] as NavigationOption[],
			leagueOptions: [] as NavigationOption[],
			divisionOptions: [] as NavigationOption[],
			teamOptions: [] as NavigationOption[],
			standings: [] as StandingsRow[],
			roster: [] as RosterRow[],
			schedule: [] as ScheduleRow[],
			error: 'Unable to load team details right now.'
		};
	}
};
