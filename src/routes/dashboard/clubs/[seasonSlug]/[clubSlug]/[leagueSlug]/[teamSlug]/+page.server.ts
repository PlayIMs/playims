import { error, redirect } from '@sveltejs/kit';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	resolveClubForSeason,
	resolveClubLeagueForClub,
	resolveClubTeamForLeague
} from '$lib/server/club-sports-scope';
import type { PageServerLoad } from './$types';

const formatUserDisplayName = (user: { firstName?: string | null; lastName?: string | null; email?: string | null }) => {
	const fullName = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(' ').trim();
	if (fullName.length > 0) return fullName;
	return user.email?.trim() || 'Unknown Member';
};

export const load: PageServerLoad = async (event) => {
	const { platform, locals, params } = event;
	if (!platform?.env?.DB) {
		return {
			season: null,
			club: null,
			league: null,
			team: null,
			roster: [],
			schedule: [],
			officers: { club: [], team: [] },
			officerTitles: [],
			members: [],
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

		const team = await resolveClubTeamForLeague(dbOps, league, params.teamSlug);
		if (!team?.id) throw error(404, 'Team not found.');

		const [rosters, titles, assignments, users, events] = await Promise.all([
			dbOps.clubSportsTeamRosters.getByClientIdAndTeamIds(clientId, [team.id]),
			dbOps.clubSportsOfficerTitles.getByClientId(clientId),
			dbOps.clubSportsOfficerAssignments.getByClientId(clientId),
			dbOps.users.getByClientId(clientId),
			dbOps.clubSportsEvents.getByClientId(clientId)
		]);
		const titlesById = new Map(
			titles.filter((title): title is (typeof titles)[number] & { id: string } => Boolean(title.id)).map((title) => [title.id, title])
		);
		const usersById = new Map(
			users.filter((user): user is (typeof users)[number] & { id: string } => Boolean(user.id)).map((user) => [user.id, user])
		);

		return {
			season: { id: season.id, name: season.name, slug: season.slug },
			club: { id: club.id, name: club.name?.trim() || 'Club', slug: club.slug?.trim() || '' },
			league: { id: league.id, name: league.name?.trim() || 'League', slug: league.slug?.trim() || '' },
			team: {
				id: team.id,
				name: team.name?.trim() || 'Team',
				slug: team.slug?.trim() || '',
				description: team.description?.trim() || null,
				teamColor: team.teamColor?.trim() || null
			},
			roster: rosters
				.filter((roster) => !roster.dateLeft)
				.map((roster) => ({
					id: roster.id,
					userId: roster.userId,
					displayName: formatUserDisplayName(usersById.get(roster.userId) ?? {}),
					rosterStatus: roster.rosterStatus?.trim() || 'active',
					dateJoined: roster.dateJoined ?? null
				})),
			schedule: events
				.filter((clubEvent) => clubEvent.clubTeamId === team.id)
				.map((clubEvent) => ({
					id: clubEvent.id,
					opponentName: clubEvent.opponentName?.trim() || 'TBD',
					scheduledStartAt: clubEvent.scheduledStartAt ?? null,
					scheduledEndAt: clubEvent.scheduledEndAt ?? null,
					status: clubEvent.status?.trim() || 'Scheduled',
					resultLabel: clubEvent.resultLabel?.trim() || null
				})),
			officers: {
				club: assignments
					.filter((assignment) => assignment.clubId === club.id && !assignment.clubTeamId)
					.map((assignment) => ({
						id: assignment.id,
						title: titlesById.get(assignment.titleId)?.name?.trim() || 'Officer',
						memberName: formatUserDisplayName(usersById.get(assignment.userId) ?? {})
					})),
				team: assignments
					.filter((assignment) => assignment.clubTeamId === team.id)
					.map((assignment) => ({
						id: assignment.id,
						title: titlesById.get(assignment.titleId)?.name?.trim() || 'Officer',
						memberName: formatUserDisplayName(usersById.get(assignment.userId) ?? {})
					}))
			},
			officerTitles: titles
				.filter((title) => title.isActive === 1)
				.map((title) => ({
					id: title.id,
					name: title.name?.trim() || 'Officer',
					scope: title.scope?.trim() || 'club'
				})),
			members: users
				.filter((user): user is (typeof users)[number] & { id: string } => Boolean(user.id))
				.map((user) => ({
					id: user.id,
					label: formatUserDisplayName(user)
				}))
		};
	} catch (err) {
		if ((err as { status?: number })?.status === 404) {
			throw redirect(302, '/dashboard/clubs');
		}
		console.error('Failed to load club team page:', err);
		return {
			season: null,
			club: null,
			league: null,
			team: null,
			roster: [],
			schedule: [],
			officers: { club: [], team: [] },
			officerTitles: [],
			members: [],
			error: 'Unable to load club team right now.'
		};
	}
};
