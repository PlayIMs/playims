import { error, redirect } from '@sveltejs/kit';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	resolveClubForSeason,
	resolveClubLeagueForClub
} from '$lib/server/club-sports-scope';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { platform, locals, params } = event;
	if (!platform?.env?.DB) {
		return {
			season: null,
			club: null,
			league: null,
			teams: [],
			schedule: [],
			error: 'Database not configured'
		};
	}

	const clientId = requireAuthenticatedClientId(locals);
	const dbOps = await getTenantDbOps(event, clientId);

	try {
		const season = await dbOps.clubSportsSeasons.getByClientIdAndSlug(clientId, params.seasonSlug);
		if (!season?.id) throw error(404, 'Club season not found.');

		const club = await resolveClubForSeason(dbOps, clientId, season, params.clubSlug);
		if (!club?.id) throw error(404, 'Club not found.');

		const league = await resolveClubLeagueForClub(dbOps, club, params.leagueSlug);
		if (!league?.id) throw error(404, 'League not found.');

		const [teams, rosters, events] = await Promise.all([
			dbOps.clubSportsTeams.getByLeagueId(league.id),
			dbOps.clubSportsTeamRosters.getByClientIdAndTeamIds(
				clientId,
				(await dbOps.clubSportsTeams.getByLeagueId(league.id)).map((team) => team.id).filter(Boolean) as string[]
			),
			dbOps.clubSportsEvents.getByClientId(clientId)
		]);
		const rosterCountByTeamId = new Map<string, number>();
		for (const roster of rosters) {
			if (!roster.clubTeamId || roster.dateLeft) continue;
			rosterCountByTeamId.set(roster.clubTeamId, (rosterCountByTeamId.get(roster.clubTeamId) ?? 0) + 1);
		}

		return {
			season: { id: season.id, name: season.name, slug: season.slug },
			club: { id: club.id, name: club.name?.trim() || 'Club', slug: club.slug?.trim() || '' },
			league: {
				id: league.id,
				name: league.name?.trim() || 'League',
				slug: league.slug?.trim() || '',
				description: league.description?.trim() || null
			},
			teams: teams.map((team) => ({
				id: team.id,
				name: team.name?.trim() || 'Team',
				slug: team.slug?.trim() || '',
				rosterSize: rosterCountByTeamId.get(team.id) ?? team.currentRosterSize ?? 0,
				teamColor: team.teamColor?.trim() || null
			})),
			schedule: events
				.filter((clubEvent) => clubEvent.clubLeagueId === league.id)
				.map((clubEvent) => ({
					id: clubEvent.id,
					opponentName: clubEvent.opponentName?.trim() || 'TBD',
					scheduledStartAt: clubEvent.scheduledStartAt ?? null,
					scheduledEndAt: clubEvent.scheduledEndAt ?? null,
					status: clubEvent.status?.trim() || 'Scheduled',
					resultLabel: clubEvent.resultLabel?.trim() || null
				}))
		};
	} catch (err) {
		if ((err as { status?: number })?.status === 404) {
			throw redirect(302, '/dashboard/clubs');
		}
		console.error('Failed to load club league page:', err);
		return {
			season: null,
			club: null,
			league: null,
			teams: [],
			schedule: [],
			error: 'Unable to load club league right now.'
		};
	}
};
