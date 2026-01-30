import { DatabaseOperations } from '$lib/database/operations/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	// Ensure we have the database binding
	if (!platform?.env?.DB) {
		console.error('Database binding not found');
		return {
			stats: getDefaultStats(),
			todaysEvents: [],
			announcements: [],
			leagueHealth: [],
			error: 'Database not configured'
		};
	}

	const db = new DatabaseOperations(platform);
	const clientId = '6eb657af-4ab8-4a13-980a-add993f78d65'; // Default client from seed

	try {
		// Get today's date range (UTC)
		const today = new Date();
		const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
		const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

		// Fetch all data in parallel
		const [
			users,
			allEvents,
			pendingRosters,
			facilities,
			announcements,
			standings,
			leagues
		] = await Promise.all([
			// Active players count
			db.users.getAll(clientId),
			// All events for today and upcoming
			db.events.getAll(clientId),
			// Pending rosters (rosters with unverified players)
			db.rosters.getAll(),
			// Facilities for capacity calculation
			db.facilities.getAll(clientId),
			// Active announcements
			db.announcements.getAll(clientId),
			// Division standings for league health
			db.divisionStandings.getAll(clientId),
			// Leagues for season progress
			db.leagues.getAll(clientId)
		]);

		// Calculate stats
		const activePlayers = users.filter(u => u.status === 'active').length;
		const todaysEvents = allEvents.filter(evt => {
			const evtDate = new Date(evt.scheduledStartAt || '');
			const now = new Date();
			return evtDate.toDateString() === now.toDateString();
		});
		const gamesToday = todaysEvents.length;
		const liveGames = todaysEvents.filter(evt => evt.status === 'in_progress').length;
		const pendingRostersCount = pendingRosters.filter(r => r.isActive === 1).length;
		
		// Calculate facility load based on today's bookings
		const facilityLoad = facilities.length > 0 
			? Math.round((todaysEvents.length / (facilities.length * 4)) * 100) // Assume 4 slots per facility per day
			: 0;

		// Format today's events for the dashboard
		const formattedEvents = await Promise.all(
			todaysEvents.map(async (evt) => {
				// Fetch team names
				const [homeTeam, awayTeam, facility, area] = await Promise.all([
					evt.homeTeamId ? db.teams.getById(evt.homeTeamId) : null,
					evt.awayTeamId ? db.teams.getById(evt.awayTeamId) : null,
					evt.facilityId ? db.facilities.getById(evt.facilityId) : null,
					evt.facilityAreaId ? db.facilityAreas.getById(evt.facilityAreaId) : null
				]);

				const sport = evt.sportId ? await db.sports.getById(evt.sportId) : null;
				
				const startTime = new Date(evt.scheduledStartAt || '');
				const timeStr = startTime.toLocaleTimeString('en-US', { 
					hour: 'numeric', 
					minute: '2-digit',
					hour12: true 
				});

				return {
					id: evt.id,
					time: timeStr,
					sport: sport?.name || 'Unknown Sport',
					teams: `${homeTeam?.name || 'TBD'} vs. ${awayTeam?.name || 'TBD'}`,
					field: area?.name || facility?.name || 'TBD',
					status: evt.status,
					homeScore: evt.homeScore,
					awayScore: evt.awayScore
				};
			})
		);

		// Format priority actions from announcements
		const priorityActions = announcements
			.filter(a => a.isActive === 1)
			.sort((a, b) => {
				// Pinned announcements first, then by published date
				if (a.isPinned !== b.isPinned) return (b.isPinned || 0) - (a.isPinned || 0);
				return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
			})
			.slice(0, 5)
			.map(a => ({
				id: a.id,
				title: a.title,
				content: a.body,
				action: a.isPinned ? 'Action Required' : 'View Details',
				urgent: a.isPinned === 1
			}));

		// Calculate league health from standings
		const leagueHealthMap = new Map();
		
		for (const standing of standings) {
			if (!standing.divisionId) continue;
			
			const division = await db.divisions.getById(standing.divisionId);
			if (!division) continue;
			
			const league = division.leagueId ? await db.leagues.getById(division.leagueId) : null;
			if (!league) continue;
			
			const sport = league.sportId ? await db.sports.getById(league.sportId) : null;
			
			const key = `${sport?.name || 'Unknown'} (${division.name})`;
			const existing = leagueHealthMap.get(key);
			
			if (!existing) {
				leagueHealthMap.set(key, {
					sport: key,
					teamCount: 1,
					gamesPlayed: standing.gamesPlayed || 0,
					totalGames: (standing.gamesPlayed || 0) + 10 // Estimate remaining
				});
			} else {
				existing.teamCount++;
				existing.gamesPlayed += (standing.gamesPlayed || 0);
			}
		}

		const leagueHealth = Array.from(leagueHealthMap.values()).map(l => ({
			sport: l.sport,
			teamCount: l.teamCount,
			progress: Math.round((l.gamesPlayed / (l.teamCount * 10)) * 100) // Rough estimate
		}));

		return {
			stats: {
				activePlayers,
				gamesToday,
				liveGames,
				pendingRosters: pendingRostersCount,
				facilityLoad: Math.min(facilityLoad, 100)
			},
			todaysEvents: formattedEvents,
			priorityActions,
			leagueHealth
		};

	} catch (error) {
		console.error('Dashboard load error:', error);
		return {
			stats: getDefaultStats(),
			todaysEvents: [],
			priorityActions: [],
			leagueHealth: [],
			error: 'Failed to load dashboard data'
		};
	}
};

function getDefaultStats() {
	return {
		activePlayers: 0,
		gamesToday: 0,
		liveGames: 0,
		pendingRosters: 0,
		facilityLoad: 0
	};
}
