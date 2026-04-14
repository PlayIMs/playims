import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import type { Facility } from '$lib/database/schema/facilities';
import type { FacilityArea } from '$lib/database/schema/facility-areas';
import type { League } from '$lib/database/schema/leagues';
import type { Division } from '$lib/database/schema/divisions';
import type { Offering } from '$lib/database/schema/offerings';
import type { Season } from '$lib/database/schema/seasons';
import type { PageServerLoad } from './$types';
import {
	buildScheduleOptionCollections,
	summarizeScheduleEvents,
	type ScheduleEventRecord,
	type ScheduleOptionCount
} from '$lib/utils/schedule-page.js';
import {
	buildScheduleCreateEventOptions,
	buildScheduleEvent,
	mapById,
	resolveDefaultSeasonId
} from '$lib/server/schedule-events.js';

export const load: PageServerLoad = async (event) => {
	const { platform, locals } = event;
	if (!platform?.env?.DB) {
		return {
			clientId: null,
			currentSeasonId: null as string | null,
			currentSeasonName: null as string | null,
			generatedAt: new Date().toISOString(),
			summary: {
				total: 0,
				live: 0,
				scheduled: 0,
				completed: 0,
				needsAttention: 0
			},
			events: [] as ScheduleEventRecord[],
			seasonOptions: [] as ScheduleOptionCount[],
			offeringOptions: [] as ScheduleOptionCount[],
			leagueOptions: [] as ScheduleOptionCount[],
			divisionOptions: [] as ScheduleOptionCount[],
			teamOptions: [] as ScheduleOptionCount[],
			statusOptions: [] as ScheduleOptionCount[],
			createEventOptions: {
				seasons: [],
				offerings: [],
				leagues: [],
				divisions: [],
				teams: [],
				facilities: [],
				facilityAreas: []
			},
			error: 'Database not configured'
		};
	}

	const clientId = requireAuthenticatedClientId(locals);
	const db = await getTenantDbOps(event, clientId);

	try {
		const [events, teams, offerings, leagues, facilities, facilityAreas, seasons] =
			await Promise.all([
				db.events.getByClientId(clientId),
				db.teams.getByClientId(clientId),
				db.offerings.getByClientId(clientId),
				db.leagues.getByClientId(clientId),
				db.facilities.getAll(clientId),
				db.facilityAreas.getAll(clientId),
				db.seasons.getByClientId(clientId)
			]);

		const leagueIds = leagues
			.map((league) => league.id)
			.filter((leagueId): leagueId is string => Boolean(leagueId));
		const divisions = await db.divisions.getByLeagueIds(leagueIds);

		const teamsById = mapById(teams);
		const offeringsById = mapById(
			offerings.filter((offering): offering is Offering & { id: string } => Boolean(offering.id))
		);
		const seasonsById = mapById(
			seasons.filter((season): season is Season & { id: string } => Boolean(season.id))
		);
		const leaguesById = mapById(
			leagues.filter((league): league is League & { id: string } => Boolean(league.id))
		);
		const divisionsById = mapById(
			divisions.filter((division): division is Division & { id: string } => Boolean(division.id))
		);
		const facilitiesById = mapById(
			facilities.filter((facility): facility is Facility & { id: string } => Boolean(facility.id))
		);
		const facilityAreasById = mapById(
			facilityAreas.filter((area): area is FacilityArea & { id: string } => Boolean(area.id))
		);

		const activeEvents = events.filter((event) => event.isActive !== 0);
		const currentSeasonId = resolveDefaultSeasonId(seasons);
		const currentSeasonName =
			(currentSeasonId ? seasonsById.get(currentSeasonId)?.name?.trim() : '') || null;
		const scheduleEvents = activeEvents
			.map((event) =>
				buildScheduleEvent(
					event,
					teamsById,
					offeringsById,
					seasonsById,
					leaguesById,
					divisionsById,
					facilitiesById,
					facilityAreasById
				)
			)
			.sort((a, b) => {
				const aStart = Date.parse(a.scheduledStartAt ?? '');
				const bStart = Date.parse(b.scheduledStartAt ?? '');
				const aValue = Number.isFinite(aStart) ? aStart : Number.POSITIVE_INFINITY;
				const bValue = Number.isFinite(bStart) ? bStart : Number.POSITIVE_INFINITY;
				if (aValue !== bValue) return aValue - bValue;
				const scoreDiff = b.scoreSortValue - a.scoreSortValue;
				if (scoreDiff !== 0) return scoreDiff;
				return a.matchup.localeCompare(b.matchup);
			});

		const summary = summarizeScheduleEvents(scheduleEvents);
		const optionCollections = buildScheduleOptionCollections(scheduleEvents);
		const createEventOptions = buildScheduleCreateEventOptions({
			seasons,
			offerings,
			leagues,
			divisions,
			teams,
			facilities,
			facilityAreas
		});

		return {
			clientId,
			currentSeasonId,
			currentSeasonName,
			generatedAt: new Date().toISOString(),
			summary,
			events: scheduleEvents,
			seasonOptions: optionCollections.seasonOptions,
			offeringOptions: optionCollections.offeringOptions,
			leagueOptions: optionCollections.leagueOptions,
			divisionOptions: optionCollections.divisionOptions,
			teamOptions: optionCollections.teamOptions,
			statusOptions: optionCollections.statusOptions,
			createEventOptions
		};
	} catch (err) {
		console.error('Failed to load schedule page:', err);
		return {
			clientId,
			currentSeasonId: null as string | null,
			currentSeasonName: null as string | null,
			generatedAt: new Date().toISOString(),
			summary: {
				total: 0,
				live: 0,
				scheduled: 0,
				completed: 0,
				needsAttention: 0
			},
			events: [] as ScheduleEventRecord[],
			seasonOptions: [] as ScheduleOptionCount[],
			offeringOptions: [] as ScheduleOptionCount[],
			leagueOptions: [] as ScheduleOptionCount[],
			divisionOptions: [] as ScheduleOptionCount[],
			teamOptions: [] as ScheduleOptionCount[],
			statusOptions: [] as ScheduleOptionCount[],
			createEventOptions: {
				seasons: [],
				offerings: [],
				leagues: [],
				divisions: [],
				teams: [],
				facilities: [],
				facilityAreas: []
			},
			error: 'Unable to load schedule right now'
		};
	}
};
