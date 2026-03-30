import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import type { Event } from '$lib/database/schema/events';
import type { Facility } from '$lib/database/schema/facilities';
import type { FacilityArea } from '$lib/database/schema/facility-areas';
import type { League } from '$lib/database/schema/leagues';
import type { Division } from '$lib/database/schema/divisions';
import type { Offering } from '$lib/database/schema/offerings';
import type { Season } from '$lib/database/schema/seasons';
import type { Team } from '$lib/database/schema/teams';
import type { PageServerLoad } from './$types';
import {
	buildScheduleOptionCollections,
	summarizeScheduleEvents,
	type ScheduleEventRecord,
	type ScheduleOptionCount,
	type ScheduleStatus
} from '$lib/utils/schedule-page.js';

const STATUS_LABELS: Record<ScheduleStatus, string> = {
	scheduled: 'Scheduled',
	in_progress: 'Live',
	completed: 'Completed',
	cancelled: 'Cancelled',
	postponed: 'Postponed',
	other: 'Other'
};

function normalizeStatus(value: string | null): ScheduleStatus {
	if (!value) return 'scheduled';
	const normalized = value.trim().toLowerCase();

	if (normalized === 'scheduled') return 'scheduled';
	if (normalized === 'in_progress' || normalized === 'in-progress' || normalized === 'live') {
		return 'in_progress';
	}
	if (normalized === 'completed' || normalized === 'final') return 'completed';
	if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
	if (normalized === 'postponed') return 'postponed';

	return 'other';
}

function mapById<T extends { id: string }>(items: T[]) {
	return new Map(items.map((item) => [item.id, item]));
}

function sortSeasonsDescending(
	a: Pick<Season, 'startDate' | 'name'>,
	b: Pick<Season, 'startDate' | 'name'>
) {
	return (
		(b.startDate ?? '').localeCompare(a.startDate ?? '') ||
		(b.name ?? '').localeCompare(a.name ?? '')
	);
}

function resolveDefaultSeasonId(seasons: Season[]): string | null {
	const eligibleSeasons = seasons.filter(
		(season): season is Season & { id: string; startDate: string } =>
			Boolean(season.id) && Boolean(season.startDate)
	);
	if (eligibleSeasons.length === 0) return null;

	const explicitCurrent = eligibleSeasons.find((season) => season.isCurrent === 1);
	if (explicitCurrent) return explicitCurrent.id;

	const today = new Date().toISOString().slice(0, 10);
	const inRange = eligibleSeasons.find(
		(season) => season.startDate <= today && (!season.endDate || season.endDate >= today)
	);
	if (inRange) return inRange.id;

	const started = eligibleSeasons
		.filter((season) => season.startDate <= today)
		.sort(sortSeasonsDescending);
	if (started[0]) return started[0].id;

	return (
		[...eligibleSeasons].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0]
			?.id ?? null
	);
}

function buildScheduleEvent(
	event: Event,
	teamsById: Map<string, Team>,
	offeringsById: Map<string, Offering>,
	seasonsById: Map<string, Season>,
	leaguesById: Map<string, League>,
	divisionsById: Map<string, Division>,
	facilitiesById: Map<string, Facility>,
	facilityAreasById: Map<string, FacilityArea>
): ScheduleEventRecord {
	const status = normalizeStatus(event.status ?? null);
	const homeTeam = event.homeTeamId ? teamsById.get(event.homeTeamId) : undefined;
	const awayTeam = event.awayTeamId ? teamsById.get(event.awayTeamId) : undefined;
	const offering = event.offeringId ? offeringsById.get(event.offeringId) : undefined;
	const season = offering?.seasonId ? seasonsById.get(offering.seasonId) : undefined;
	const league = event.leagueId ? leaguesById.get(event.leagueId) : undefined;
	const division = event.divisionId ? divisionsById.get(event.divisionId) : undefined;
	const facility = event.facilityId ? facilitiesById.get(event.facilityId) : undefined;
	const facilityArea = event.facilityAreaId
		? facilityAreasById.get(event.facilityAreaId)
		: undefined;

	const homeTeamName = homeTeam?.name?.trim() || 'TBD';
	const awayTeamName = awayTeam?.name?.trim() || 'TBD';
	const offeringName = offering?.name?.trim() || 'General';
	const seasonName = season?.name?.trim() || 'Unassigned season';
	const leagueName = league?.name?.trim() || 'Unassigned league';
	const divisionName = division?.name?.trim() || 'Unassigned division';
	const facilityName = facility?.name?.trim() || 'TBD location';
	const facilityAreaName = facilityArea?.name?.trim() || '';
	const location = facilityAreaName ? `${facilityName} - ${facilityAreaName}` : facilityName;
	const hasScores = event.homeScore !== null && event.homeScore !== undefined;
	const score = hasScores ? `${event.homeScore} - ${event.awayScore ?? 0}` : null;

	return {
		id: event.id,
		type: event.type || 'game',
		status,
		rawStatus: event.status ?? null,
		statusLabel: STATUS_LABELS[status],
		scheduledStartAt: event.scheduledStartAt ?? null,
		scheduledEndAt: event.scheduledEndAt ?? null,
		seasonId: offering?.seasonId ?? null,
		seasonName,
		offeringId: event.offeringId ?? null,
		offeringName,
		leagueId: event.leagueId ?? null,
		leagueName,
		divisionId: event.divisionId ?? null,
		divisionName,
		homeTeamId: event.homeTeamId ?? null,
		homeTeamName,
		awayTeamId: event.awayTeamId ?? null,
		awayTeamName,
		matchup: `${homeTeamName} vs ${awayTeamName}`,
		facilityId: event.facilityId ?? null,
		facilityName,
		facilityAreaId: event.facilityAreaId ?? null,
		facilityAreaName,
		location,
		weekNumber: event.weekNumber ?? null,
		roundLabel: event.roundLabel ?? null,
		notes: event.notes ?? null,
		isPostseason: event.isPostseason === 1,
		score,
		scoreSortValue: hasScores ? 1 : 0
	};
}

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
			statusOptions: optionCollections.statusOptions
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
			error: 'Unable to load schedule right now'
		};
	}
};
