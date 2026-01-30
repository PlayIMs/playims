import { DatabaseOperations } from '$lib/database/operations/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) {
		return {
			stats: getDefaultStats(),
			todaysEvents: [],
			upcomingEvents: [],
			recentActivity: [],
			alerts: [],
			quickStats: [],
			error: 'Database not configured'
		};
	}

	const db = new DatabaseOperations(platform);
	const clientId = '6eb657af-4ab8-4a13-980a-add993f78d65';

	try {
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
		const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
		const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

		// Fetch all data
		const [
			users,
			allEvents,
			teams,
			leagues,
			divisions,
			facilities,
			announcements,
			rosters
		] = await Promise.all([
			db.users.getAll(clientId),
			db.events.getAll(clientId),
			db.teams.getAll(clientId),
			db.leagues.getAll(clientId),
			db.divisions.getAll(),
			db.facilities.getAll(clientId),
			db.announcements.getAll(clientId),
			db.rosters.getAll()
		]);

		// Filter events
		const todaysEvents = allEvents.filter(evt => {
			if (!evt.scheduledStartAt) return false;
			const evtDate = new Date(evt.scheduledStartAt);
			return evtDate >= new Date(todayStart) && evtDate < new Date(todayEnd);
		});

		const upcomingEvents = allEvents
			.filter(evt => {
				if (!evt.scheduledStartAt) return false;
				const evtDate = new Date(evt.scheduledStartAt);
				return evtDate >= new Date(todayEnd) && evtDate < new Date(weekEnd);
			})
			.slice(0, 5);

		const liveGames = todaysEvents.filter(evt => evt.status === 'in_progress');
		const completedToday = todaysEvents.filter(evt => evt.status === 'completed');

		// Format events with details
		const formatEvent = async (evt: any) => {
			const [homeTeam, awayTeam, facility, sport] = await Promise.all([
				evt.homeTeamId ? db.teams.getById(evt.homeTeamId) : null,
				evt.awayTeamId ? db.teams.getById(evt.awayTeamId) : null,
				evt.facilityId ? db.facilities.getById(evt.facilityId) : null,
				evt.sportId ? db.sports.getById(evt.sportId) : null
			]);

			const startTime = evt.scheduledStartAt ? new Date(evt.scheduledStartAt) : null;
			
			return {
				id: evt.id,
				time: startTime?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) || 'TBD',
				date: startTime?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) || 'TBD',
				sport: sport?.name || 'Unknown',
				matchup: `${homeTeam?.name || 'TBD'} vs ${awayTeam?.name || 'TBD'}`,
				location: facility?.name || 'TBD',
				status: evt.status || 'scheduled',
				score: evt.homeScore !== null ? `${evt.homeScore}-${evt.awayScore}` : null
			};
		};

		const formattedTodaysEvents = await Promise.all(todaysEvents.map(formatEvent));
		const formattedUpcoming = await Promise.all(upcomingEvents.map(formatEvent));

		// Calculate meaningful stats
		const activeUsers = users.filter(u => u.status === 'active').length;
		const activeTeams = teams.filter(t => t.teamStatus === 'active').length;
		const activeLeagues = leagues.filter(l => l.isActive === 1).length;
		
		// Pending actions (rosters needing attention, etc)
		const pendingRosters = rosters.filter(r => r.rosterStatus === 'pending').length;
		
		// Recent activity from audit logs or recent registrations
		const recentTeams = teams
			.filter(t => t.dateRegistered)
			.sort((a, b) => new Date(b.dateRegistered!).getTime() - new Date(a.dateRegistered!).getTime())
			.slice(0, 5);

		const recentActivity = recentTeams.map(t => ({
			type: 'team_registered',
			message: `Team "${t.name}" registered`,
			time: t.dateRegistered ? new Date(t.dateRegistered).toLocaleDateString() : 'Recently'
		}));

		// Priority alerts from announcements
		const alerts = announcements
			.filter(a => a.isActive === 1)
			.sort((a, b) => (b.isPinned || 0) - (a.isPinned || 0))
			.slice(0, 3)
			.map(a => ({
				id: a.id,
				title: a.title,
				message: a.body || '',
				priority: a.isPinned ? 'high' : 'normal',
				date: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : 'Today'
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
				pendingActions: pendingRosters
			},
			todaysEvents: formattedTodaysEvents,
			upcomingEvents: formattedUpcoming,
			recentActivity,
			alerts
		};

	} catch (error) {
		console.error('Dashboard load error:', error);
		return {
			stats: getDefaultStats(),
			todaysEvents: [],
			upcomingEvents: [],
			recentActivity: [],
			alerts: [],
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
		pendingActions: 0
	};
}
