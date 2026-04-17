import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps, getTenantDbOps } from '$lib/server/database/context';
import { buildMemberSearchHref, buildTeamSearchHref } from '$lib/search/utils.js';
import type { PageServerLoad } from './$types';

type ActivityLink = {
	label: string;
	href: string;
};

const buildOfferingHref = (seasonSlug: string, offeringSlug: string): string =>
	`/dashboard/offerings/${seasonSlug}/${offeringSlug}`;

const buildLeagueHref = (seasonSlug: string, offeringSlug: string, leagueSlug: string): string =>
	`/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}`;

const buildDivisionHref = (
	seasonSlug: string,
	offeringSlug: string,
	leagueSlug: string,
	divisionSlug: string
): string => `/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}/${divisionSlug}`;

const normalizeRouteSegment = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim() ?? '';
	return trimmed.length > 0 ? trimmed : null;
};

const buildUserDisplayName = (user: {
	firstName?: string | null;
	lastName?: string | null;
	email?: string | null;
}): string => {
	const fullName = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(' ').trim();
	if (fullName) return fullName;
	const email = user.email?.trim() ?? '';
	return email || 'Unknown user';
};

const buildMemberDirectoryHref = (name: string): string => {
	const url = new URL('https://playims.test/dashboard/members');
	url.searchParams.set('q', name.trim());
	return `${url.pathname}${url.search}`;
};

const buildActivityLink = (label: string | null | undefined, href: string | null): ActivityLink | null => {
	const trimmedLabel = label?.trim() ?? '';
	if (!trimmedLabel || !href) return null;
	return {
		label: trimmedLabel,
		href
	};
};

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!platform?.env?.DB) {
		return {
			stats: getDefaultStats(),
			todaysEvents: [],
			upcomingEvents: [],
			recentActivity: [],
			seasonHistory: [],
			alerts: [],
			currentSeason: null,
			registrationDeadlines: [],
			error: 'Database not configured'
		};
	}

	const clientId = requireAuthenticatedClientId(locals);
	const centralDb = getCentralDbOps({ platform, locals });
	const tenantDb = await getTenantDbOps({ platform, locals }, clientId);

	try {
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
		const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
		const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

		const [
			users,
			allEvents,
			teams,
			leagues,
			offerings,
			facilities,
			announcements,
			rosters,
			currentSeason,
			seasons
		] = await Promise.all([
			centralDb.users.getByClientId(clientId),
			tenantDb.events.getByClientId(clientId),
			tenantDb.teams.getByClientId(clientId),
			tenantDb.leagues.getByClientId(clientId),
			tenantDb.offerings.getByClientId(clientId),
			tenantDb.facilities.getAll(clientId),
			tenantDb.announcements.getAll(clientId),
			tenantDb.rosters.getByClientId(clientId),
			tenantDb.seasons.getCurrentByClientId(clientId),
			tenantDb.seasons.getByClientId(clientId)
		]);
		const divisions = await tenantDb.divisions.getByLeagueIds(
			leagues
				.map((league) => league.id?.trim() ?? '')
				.filter((leagueId) => leagueId.length > 0)
		);

		const teamsById = new Map(
			teams.filter((team) => Boolean(team.id)).map((team) => [team.id as string, team])
		);
		const facilitiesById = new Map(
			facilities
				.filter((facility) => Boolean(facility.id))
				.map((facility) => [facility.id as string, facility])
		);
		const offeringsById = new Map(
			offerings
				.filter((offering) => Boolean(offering.id))
				.map((offering) => [offering.id as string, offering])
		);
		const leaguesById = new Map(
			leagues.filter((league) => Boolean(league.id)).map((league) => [league.id as string, league])
		);
		const divisionsById = new Map(
			divisions
				.filter((division) => Boolean(division.id))
				.map((division) => [division.id as string, division])
		);
		const activeUsersById = new Map(
			users.filter((user) => Boolean(user.id)).map((user) => [user.id as string, user])
		);
		const seasonsById = new Map(
			seasons.filter((season) => Boolean(season.id)).map((season) => [season.id as string, season])
		);

		const todaysEvents = allEvents.filter((evt) => {
			if (!evt.scheduledStartAt) return false;
			const evtDate = new Date(evt.scheduledStartAt);
			return evtDate >= new Date(todayStart) && evtDate < new Date(todayEnd);
		});

		const upcomingEvents = allEvents
			.filter((evt) => {
				if (!evt.scheduledStartAt) return false;
				const evtDate = new Date(evt.scheduledStartAt);
				return evtDate >= new Date(todayEnd) && evtDate < new Date(weekEnd);
			})
			.slice(0, 5);

		const liveGames = todaysEvents.filter((evt) => evt.status === 'in_progress');
		const completedToday = todaysEvents.filter((evt) => evt.status === 'completed');

		const formatEvent = (evt: (typeof allEvents)[number]) => {
			const homeTeam = evt.homeTeamId ? teamsById.get(evt.homeTeamId) : null;
			const awayTeam = evt.awayTeamId ? teamsById.get(evt.awayTeamId) : null;
			const facility = evt.facilityId ? facilitiesById.get(evt.facilityId) : null;
			const offering = evt.offeringId ? offeringsById.get(evt.offeringId) : null;
			const startTime = evt.scheduledStartAt ? new Date(evt.scheduledStartAt) : null;

			return {
				id: evt.id,
				scheduledStartAt: evt.scheduledStartAt ?? null,
				time:
					startTime?.toLocaleTimeString('en-US', {
						hour: 'numeric',
						minute: '2-digit',
						hour12: true
					}) || 'TBD',
				date:
					startTime?.toLocaleDateString('en-US', {
						weekday: 'short',
						month: 'short',
						day: 'numeric'
					}) || 'TBD',
				sport: offering?.name || 'Unknown',
				matchup: `${homeTeam?.name || 'TBD'} vs ${awayTeam?.name || 'TBD'}`,
				location: facility?.name || 'TBD',
				status: evt.status || 'scheduled',
				score: evt.homeScore !== null ? `${evt.homeScore}-${evt.awayScore}` : null
			};
		};

		const formattedTodaysEvents = todaysEvents.map(formatEvent);
		const formattedUpcoming = upcomingEvents.map(formatEvent);

		const activeUsers = users.filter((u) => u.status === 'active').length;
		const activeTeams = teams.filter((t) => t.teamStatus === 'active').length;
		const activeLeagues = leagues.filter((l) => l.isActive === 1).length;
		const pendingRosters = rosters.filter((r) => r.rosterStatus === 'pending').length;

		const recentTeams = teams
			.filter((t) => t.dateRegistered)
			.sort(
				(a, b) =>
					new Date(b.dateRegistered!).getTime() - new Date(a.dateRegistered!).getTime()
			)
			.slice(0, 5);

		const recentCreatorIds = Array.from(
			new Set(
				recentTeams
					.map((team) => team.createdUser?.trim() ?? '')
					.filter((creatorId) => creatorId.length > 0)
			)
		);
		const [recentCreators, recentMemberships] = await Promise.all([
			Promise.all(recentCreatorIds.map((creatorId) => centralDb.users.getAuthById(creatorId))),
			Promise.all(
				recentCreatorIds.map((creatorId) => centralDb.userClients.getMembership(creatorId, clientId))
			)
		]);
		const creatorUsersById = new Map(
			recentCreators
				.filter((user): user is NonNullable<(typeof recentCreators)[number]> => Boolean(user?.id))
				.map((user) => [user.id as string, user])
		);
		const membershipsByUserId = new Map(
			recentMemberships
				.filter(
					(membership): membership is NonNullable<(typeof recentMemberships)[number]> =>
						Boolean(membership?.userId)
				)
				.map((membership) => [membership.userId as string, membership])
		);

		const recentActivity = recentTeams.map((team) => {
			const creatorUserId = team.createdUser?.trim() ?? '';
			const creator =
				creatorUsersById.get(creatorUserId) ?? activeUsersById.get(creatorUserId) ?? null;
			const creatorName = creator ? buildUserDisplayName(creator) : 'Unknown user';
			const creatorMembership = membershipsByUserId.get(creatorUserId) ?? null;
			const creatorHref = creatorMembership?.id
				? buildMemberSearchHref({
						membershipId: creatorMembership.id,
						fullName: creatorName
					})
				: buildMemberDirectoryHref(creatorName);

			const division = team.divisionId ? divisionsById.get(team.divisionId) : null;
			const league = division?.leagueId ? leaguesById.get(division.leagueId) : null;
			const offering = league?.offeringId ? offeringsById.get(league.offeringId) : null;
			const season = league?.seasonId ? seasonsById.get(league.seasonId) : null;

			const seasonSlug = normalizeRouteSegment(season?.slug) ?? normalizeRouteSegment(season?.id);
			const offeringSlug =
				normalizeRouteSegment(offering?.slug) ?? normalizeRouteSegment(offering?.id);
			const leagueSlug = normalizeRouteSegment(league?.slug) ?? normalizeRouteSegment(league?.id);
			const divisionSlug =
				normalizeRouteSegment(division?.slug) ?? normalizeRouteSegment(division?.id);
			const teamSlug = normalizeRouteSegment(team.slug) ?? normalizeRouteSegment(team.id);

			const offeringHref =
				seasonSlug && offeringSlug ? buildOfferingHref(seasonSlug, offeringSlug) : null;
			const leagueHref =
				seasonSlug && offeringSlug && leagueSlug
					? buildLeagueHref(seasonSlug, offeringSlug, leagueSlug)
					: null;
			const divisionHref =
				seasonSlug && offeringSlug && leagueSlug && divisionSlug
					? buildDivisionHref(seasonSlug, offeringSlug, leagueSlug, divisionSlug)
					: null;
			const teamHref =
				seasonSlug && offeringSlug && leagueSlug && divisionSlug && teamSlug
					? buildTeamSearchHref({
							seasonSlug,
							offeringSlug,
							leagueSlug,
							divisionSlug,
							teamSlug
						})
					: null;

			return {
				type: 'team_registered',
				time: team.dateRegistered
					? new Date(team.dateRegistered).toLocaleDateString('en-US', {
							month: 'short',
							day: 'numeric',
							year: 'numeric'
						})
					: 'Recently',
				timeValue: team.dateRegistered ?? null,
				creator: buildActivityLink(creatorName, creatorHref),
				team: buildActivityLink(team.name, teamHref),
				league: buildActivityLink(league?.name ?? 'League', leagueHref),
				offering: buildActivityLink(offering?.name ?? 'Offering', offeringHref),
				division: buildActivityLink(division?.name ?? 'Division', divisionHref)
			};
		});

		const alerts = announcements
			.filter((a) => a.isActive === 1)
			.sort((a, b) => (b.isPinned || 0) - (a.isPinned || 0))
			.slice(0, 3)
			.map((a) => ({
				id: a.id,
				title: a.title,
				message: a.body || '',
				priority: a.isPinned ? 'high' : 'normal',
				date: a.publishedAt
					? new Date(a.publishedAt).toLocaleDateString()
					: 'Today'
			}));

		const currentSeasonId = currentSeason?.id ?? null;
		const seasonOfferings = currentSeasonId
			? offerings.filter((o) => o.seasonId === currentSeasonId)
			: [];
		const seasonLeagues = currentSeasonId
			? leagues.filter((l) => l.seasonId === currentSeasonId)
			: [];
		const seasonLeagueIds = new Set(
			seasonLeagues
				.map((league) => league.id?.trim() ?? '')
				.filter((leagueId) => leagueId.length > 0)
		);
		const seasonDivisions = divisions.filter((division) => {
			const leagueId = division.leagueId?.trim() ?? '';
			return leagueId.length > 0 && seasonLeagueIds.has(leagueId);
		});
		const seasonDivisionIds = new Set(
			seasonDivisions
				.map((division) => division.id?.trim() ?? '')
				.filter((divisionId) => divisionId.length > 0)
		);
		const seasonTeams = teams.filter((team) => {
			const divisionId = team.divisionId?.trim() ?? '';
			return divisionId.length > 0 && seasonDivisionIds.has(divisionId) && team.teamStatus === 'active';
		});
		const seasonTeamIds = new Set(
			seasonTeams.map((team) => team.id?.trim() ?? '').filter((teamId) => teamId.length > 0)
		);
		const seasonPlayerCount = new Set(
			rosters
				.filter((roster) => {
					const teamId = roster.teamId?.trim() ?? '';
					return teamId.length > 0 && seasonTeamIds.has(teamId) && roster.rosterStatus === 'active';
				})
				.map((roster) => roster.userId?.trim() ?? '')
				.filter((userId) => userId.length > 0)
		).size;

		const registrationDeadlines = seasonLeagues
			.filter((l) => {
				if (!l.regEndDate || l.isActive !== 1) return false;
				return new Date(l.regEndDate) >= now;
			})
			.sort(
				(a, b) => new Date(a.regEndDate!).getTime() - new Date(b.regEndDate!).getTime()
			)
			.slice(0, 5)
			.map((l) => {
				const offering = l.offeringId ? offeringsById.get(l.offeringId) : null;
				return {
					id: l.id,
					leagueName: l.name ?? 'Unnamed League',
					offeringName: offering?.name ?? 'Unknown',
					regEndDate: l.regEndDate!,
					regEndLabel: new Date(l.regEndDate!).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})
				};
			});

		const currentSeasonData = currentSeason
			? {
					id: currentSeason.id ?? null,
					name: currentSeason.name ?? 'Current Season',
					slug: currentSeason.slug ?? '',
					startDate: currentSeason.startDate ?? null,
					endDate: currentSeason.endDate ?? null,
					offeringCount: seasonOfferings.length,
					teamCount: seasonTeams.length,
					playerCount: seasonPlayerCount,
					leagueCount: seasonLeagues.length,
					divisionCount: seasonDivisions.length,
					startLabel: currentSeason.startDate
						? new Date(currentSeason.startDate).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})
						: null,
					endLabel: currentSeason.endDate
						? new Date(currentSeason.endDate).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})
						: null
				}
			: null;
		const seasonHistory = seasons
			.filter((season) => Boolean(season.id))
			.map((season) => ({
				id: season.id as string,
				name: season.name?.trim() || 'Untitled Season',
				slug: season.slug?.trim() || '',
				startDate: season.startDate?.trim() || '',
				endDate: season.endDate?.trim() || null,
				isCurrent: season.isCurrent === 1,
				isActive: season.isActive === 1
			}));

		return {
			stats: {
				totalUsers: activeUsers,
				totalTeams: activeTeams,
				totalLeagues: activeLeagues,
				totalFacilities: facilities.length,
				gamesToday: todaysEvents.length,
				liveGames: liveGames.length,
				completedToday: completedToday.length,
				pendingActions: pendingRosters,
				practicesToday: 0
			},
			todaysEvents: formattedTodaysEvents,
			upcomingEvents: formattedUpcoming,
			recentActivity,
			seasonHistory,
			alerts,
			currentSeason: currentSeasonData,
			registrationDeadlines
		};
	} catch (error) {
		console.error('Dashboard load error:', error);
		return {
			stats: getDefaultStats(),
			todaysEvents: [],
			upcomingEvents: [],
			recentActivity: [],
			seasonHistory: [],
			alerts: [],
			currentSeason: null,
			registrationDeadlines: [],
			error: 'Failed to load dashboard data'
		};
	}
};

function getDefaultStats() {
	return {
		totalUsers: 0,
		totalTeams: 0,
		totalLeagues: 0,
		totalFacilities: 0,
		gamesToday: 0,
		liveGames: 0,
		completedToday: 0,
		pendingActions: 0,
		practicesToday: 0
	};
}
