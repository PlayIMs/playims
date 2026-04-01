import type { Club, ClubLeague, ClubSeason, ClubTeam, DatabaseOperations } from '$lib/database';

export const normalizeClubSportsText = (value: string | null | undefined): string =>
	value?.trim().toLowerCase() ?? '';

export const normalizeClubSportsSlug = (value: string | null | undefined): string => {
	if (!value) return '';
	return value
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
};

export function buildSeasonScopedClubOptions(input: {
	season: Pick<ClubSeason, 'id' | 'slug'>;
	clubs: Club[];
}): Array<{ label: string; href: string }> {
	const seasonSlug = input.season.slug?.trim();
	if (!input.season.id || !seasonSlug) return [];

	return input.clubs
		.filter((club): club is Club & { id: string } => Boolean(club.id))
		.filter((club) => club.clubSeasonId === input.season.id)
		.map((club) => ({
			label: club.name?.trim() || 'Club',
			href: `/dashboard/clubs/${seasonSlug}/${club.slug?.trim() || club.id}`
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export async function resolveClubForSeason(
	dbOps: Pick<DatabaseOperations, 'clubSportsClubs'>,
	clientId: string,
	season: Pick<ClubSeason, 'id'>,
	clubSlug: string
): Promise<Club | null> {
	const normalizedSlug = normalizeClubSportsSlug(clubSlug);
	if (!normalizedSlug) return null;

	const directMatch = await dbOps.clubSportsClubs.getByClientIdSeasonIdAndSlug(
		clientId,
		season.id,
		normalizedSlug
	);
	if (directMatch?.id) return directMatch;

	const clubs = await dbOps.clubSportsClubs.getByClientId(clientId);
	return (
		clubs.find(
			(club) =>
				club.clubSeasonId === season.id &&
				normalizeClubSportsSlug(club.slug || club.name) === normalizedSlug
		) ?? null
	);
}

export async function resolveClubLeagueForClub(
	dbOps: Pick<DatabaseOperations, 'clubSportsLeagues'>,
	club: Pick<Club, 'id'>,
	leagueSlug: string
): Promise<ClubLeague | null> {
	const normalizedSlug = normalizeClubSportsSlug(leagueSlug);
	if (!normalizedSlug || !club.id) return null;

	const directMatch = await dbOps.clubSportsLeagues.getByClubIdAndSlug(club.id, normalizedSlug);
	if (directMatch?.id) return directMatch;

	const leagues = await dbOps.clubSportsLeagues.getByClubId(club.id);
	return (
		leagues.find((league) => normalizeClubSportsSlug(league.slug || league.name) === normalizedSlug) ??
		null
	);
}

export async function resolveClubTeamForLeague(
	dbOps: Pick<DatabaseOperations, 'clubSportsTeams'>,
	league: Pick<ClubLeague, 'id'>,
	teamSlug: string
): Promise<ClubTeam | null> {
	const normalizedSlug = normalizeClubSportsSlug(teamSlug);
	if (!normalizedSlug || !league.id) return null;

	const directMatch = await dbOps.clubSportsTeams.getByLeagueIdAndSlug(league.id, normalizedSlug);
	if (directMatch?.id) return directMatch;

	const teams = await dbOps.clubSportsTeams.getByLeagueId(league.id);
	return teams.find((team) => normalizeClubSportsSlug(team.slug || team.name) === normalizedSlug) ?? null;
}

export async function resolveClubSeasonForParams(
	dbOps: Pick<DatabaseOperations, 'clubSportsSeasons'>,
	clientId: string,
	seasonSlug: string
): Promise<ClubSeason | null> {
	const normalizedSlug = normalizeClubSportsSlug(seasonSlug);
	if (!normalizedSlug) return null;
	return await dbOps.clubSportsSeasons.getByClientIdAndSlug(clientId, normalizedSlug);
}

export async function resolveClubLeagueForParams(
	dbOps: Pick<DatabaseOperations, 'clubSportsClubs' | 'clubSportsLeagues'>,
	clientId: string,
	season: Pick<ClubSeason, 'id'>,
	clubSlug: string,
	leagueSlug: string
): Promise<{ club: Club; league: ClubLeague } | null> {
	if (clubSlug.trim().length > 0) {
		const club = await resolveClubForSeason(dbOps, clientId, season, clubSlug);
		if (!club?.id) return null;
		const league = await resolveClubLeagueForClub(dbOps, club, leagueSlug);
		if (!league?.id) return null;
		return { club, league };
	}

	const clubs = await dbOps.clubSportsClubs.getByClientId(clientId);
	const seasonClubs = clubs.filter((club) => club.clubSeasonId === season.id);
	for (const club of seasonClubs) {
		if (!club.id) continue;
		const league = await resolveClubLeagueForClub(dbOps, club, leagueSlug);
		if (league?.id) {
			return { club, league };
		}
	}

	return null;
}
