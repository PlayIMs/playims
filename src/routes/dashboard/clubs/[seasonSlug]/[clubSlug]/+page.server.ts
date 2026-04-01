import { error, redirect } from '@sveltejs/kit';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import {
	buildSeasonScopedClubOptions,
	resolveClubForSeason
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
			clubOptions: [],
			leagues: [],
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
		if (!season?.id) {
			throw error(404, 'Club season not found.');
		}

		const [clubs, club, leagues, titles, assignments, users] = await Promise.all([
			dbOps.clubSportsClubs.getByClientId(clientId),
			resolveClubForSeason(dbOps, clientId, season, params.clubSlug),
			dbOps.clubSportsLeagues.getByClientId(clientId),
			dbOps.clubSportsOfficerTitles.getByClientId(clientId),
			dbOps.clubSportsOfficerAssignments.getByClientId(clientId),
			dbOps.users.getByClientId(clientId)
		]);
		if (!club?.id) {
			throw error(404, 'Club not found.');
		}

		const titlesById = new Map(
			titles.filter((title): title is (typeof titles)[number] & { id: string } => Boolean(title.id)).map((title) => [title.id, title])
		);
		const usersById = new Map(
			users.filter((user): user is (typeof users)[number] & { id: string } => Boolean(user.id)).map((user) => [user.id, user])
		);
		const clubOfficers = assignments
			.filter((assignment) => assignment.clubId === club.id && !assignment.clubTeamId)
			.map((assignment) => ({
				id: assignment.id,
				title: titlesById.get(assignment.titleId)?.name?.trim() || 'Officer',
				memberName: formatUserDisplayName(usersById.get(assignment.userId) ?? {})
			}))
			.sort((a, b) => a.title.localeCompare(b.title));

		return {
			season: {
				id: season.id,
				name: season.name,
				slug: season.slug
			},
			club: {
				id: club.id,
				name: club.name?.trim() || 'Club',
				slug: club.slug?.trim() || '',
				description: club.description?.trim() || null,
				sport: club.sport?.trim() || null
			},
			clubOptions: buildSeasonScopedClubOptions({ season, clubs }),
			leagues: leagues
				.filter((league) => league.clubId === club.id)
				.map((league) => ({
					id: league.id,
					name: league.name?.trim() || 'League',
					slug: league.slug?.trim() || '',
					description: league.description?.trim() || null,
					isLocked: league.isLocked === 1,
					isActive: league.isActive === 1
				})),
			officers: {
				club: clubOfficers,
				team: assignments.filter((assignment) => assignment.clubId === club.id && Boolean(assignment.clubTeamId))
			},
			officerTitles: titles
				.filter((title) => title.isActive === 1 && (title.clubId === null || title.clubId === club.id))
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
		console.error('Failed to load club detail page:', err);
		return {
			season: null,
			club: null,
			clubOptions: [],
			leagues: [],
			officers: { club: [], team: [] },
			officerTitles: [],
			members: [],
			error: 'Unable to load club detail right now.'
		};
	}
};
