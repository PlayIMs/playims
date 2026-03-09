import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps, getTenantDbOps } from '$lib/server/database/context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!platform?.env?.DB) {
		return {
			stats: getDefaultStats(),
			todaysEvents: [],
			upcomingEvents: [],
			recentActivity: [],
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
			currentSeason
		] = await Promise.all([
			centralDb.users.getByClientId(clientId),
			tenantDb.events.getByClientId(clientId),
			tenantDb.teams.getByClientId(clientId),
			tenantDb.leagues.getByClientId(clientId),
			tenantDb.offerings.getByClientId(clientId),
			tenantDb.facilities.getAll(clientId),
			tenantDb.announcements.getAll(clientId),
			tenantDb.rosters.getByClientId(clientId),
			tenantDb.seasons.getCurrentByClientId(clientId)
		]);

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

		const recentActivity = recentTeams.map((t) => ({
			type: 'team_registered',
			message: `Team "${t.name}" registered`,
			time: t.dateRegistered ? new Date(t.dateRegistered).toLocaleDateString() : 'Recently',
			timeValue: t.dateRegistered ?? null
		}));

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
					name: currentSeason.name ?? 'Current Season',
					slug: currentSeason.slug ?? '',
					startDate: currentSeason.startDate ?? null,
					endDate: currentSeason.endDate ?? null,
					offeringCount: seasonOfferings.length,
					leagueCount: seasonLeagues.length,
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
