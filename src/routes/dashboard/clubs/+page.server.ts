import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { platform, locals } = event;
	if (!platform?.env?.DB) {
		return {
			seasons: [],
			currentSeasonId: null,
			activities: [],
			error: 'Database not configured'
		};
	}

	const clientId = requireAuthenticatedClientId(locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const [seasons, clubs, leagues] = await Promise.all([
			dbOps.clubSportsSeasons.getByClientId(clientId),
			dbOps.clubSportsClubs.getByClientId(clientId),
			dbOps.clubSportsLeagues.getByClientId(clientId)
		]);
		const teamGroups = await Promise.all(
			leagues
				.filter((league): league is (typeof leagues)[number] & { id: string } => Boolean(league.id))
				.map(async (league) => ({
					leagueId: league.id,
					teams: await dbOps.clubSportsTeams.getByLeagueId(league.id)
				}))
		);
		const teamCountByLeagueId = new Map(
			teamGroups.map((group) => [group.leagueId, group.teams.filter((team) => team.isActive === 1).length])
		);
		const clubsById = new Map(
			clubs.filter((club): club is (typeof clubs)[number] & { id: string } => Boolean(club.id)).map((club) => [club.id, club])
		);
		const seasonsById = new Map(
			seasons
				.filter((season): season is (typeof seasons)[number] & { id: string } => Boolean(season.id))
				.map((season) => [season.id, season])
		);
		const seasonsData = seasons.map((season) => ({
			id: season.id,
			name: season.name,
			slug: season.slug,
			startDate: season.startDate,
			endDate: season.endDate,
			isCurrent: season.isCurrent === 1,
			isActive: season.isActive === 1
		}));

		return {
			seasons: seasonsData,
			currentSeasonId: seasonsData.find((season) => season.isCurrent)?.id ?? null,
			activities: leagues
				.filter((league): league is (typeof leagues)[number] & { id: string } => Boolean(league.id))
				.map((league) => {
					const club = clubsById.get(league.clubId);
					return {
						id: league.id,
						leagueId: league.id,
						leagueName: league.name?.trim() || 'League',
						leagueSlug: league.slug?.trim() || '',
						clubId: club?.id ?? '',
						clubName: club?.name?.trim() || 'Club',
						clubSlug: club?.slug?.trim() || '',
						seasonId: league.clubSeasonId,
						seasonSlug: seasonsById.get(league.clubSeasonId)?.slug?.trim() || '',
						seasonName: seasonsById.get(league.clubSeasonId)?.name?.trim() || 'Season',
						teamCount: teamCountByLeagueId.get(league.id) ?? 0,
						isLocked: league.isLocked === 1,
						isActive: league.isActive === 1
					};
				})
		};
	} catch (error) {
		console.error('Failed to load club sports page:', error);
		return {
			seasons: [],
			currentSeasonId: null,
			activities: [],
			error: 'Unable to load club sports right now.'
		};
	}
};
