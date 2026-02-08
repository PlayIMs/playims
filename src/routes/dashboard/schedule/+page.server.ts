import { DatabaseOperations } from '$lib/database';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import type { Event } from '$lib/database/schema/events';
import type { Facility } from '$lib/database/schema/facilities';
import type { FacilityArea } from '$lib/database/schema/facility-areas';
import type { League } from '$lib/database/schema/leagues';
import type { Division } from '$lib/database/schema/divisions';
import type { Offering } from '$lib/database/schema/offerings';
import type { Team } from '$lib/database/schema/teams';
import type { PageServerLoad } from './$types';

type ScheduleStatus =
	| 'scheduled'
	| 'in_progress'
	| 'completed'
	| 'cancelled'
	| 'postponed'
	| 'other';

interface ScheduleEvent {
	id: string;
	type: string;
	status: ScheduleStatus;
	rawStatus: string | null;
	statusLabel: string;
	scheduledStartAt: string | null;
	scheduledEndAt: string | null;
	offeringId: string | null;
	offeringName: string;
	leagueId: string | null;
	leagueName: string;
	divisionId: string | null;
	divisionName: string;
	homeTeamId: string | null;
	homeTeamName: string;
	awayTeamId: string | null;
	awayTeamName: string;
	matchup: string;
	facilityId: string | null;
	facilityName: string;
	facilityAreaId: string | null;
	facilityAreaName: string;
	location: string;
	weekNumber: number | null;
	roundLabel: string | null;
	notes: string | null;
	isPostseason: boolean;
	score: string | null;
	scoreSortValue: number;
}

interface OptionCount {
	value: string;
	label: string;
	count: number;
}

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

function toTimestamp(value: string | null): number {
	if (!value) return Number.POSITIVE_INFINITY;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function toOptionCounts(values: string[]): OptionCount[] {
	const counter = new Map<string, number>();

	for (const value of values) {
		if (!value) continue;
		counter.set(value, (counter.get(value) ?? 0) + 1);
	}

	return Array.from(counter.entries())
		.map(([value, count]) => ({ value, label: value, count }))
		.sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count;
			return a.label.localeCompare(b.label);
		});
}

function mapById<T extends { id: string }>(items: T[]) {
	return new Map(items.map((item) => [item.id, item]));
}

function buildScheduleEvent(
	event: Event,
	teamsById: Map<string, Team>,
	offeringsById: Map<string, Offering>,
	leaguesById: Map<string, League>,
	divisionsById: Map<string, Division>,
	facilitiesById: Map<string, Facility>,
	facilityAreasById: Map<string, FacilityArea>
): ScheduleEvent {
	const status = normalizeStatus(event.status ?? null);
	const homeTeam = event.homeTeamId ? teamsById.get(event.homeTeamId) : undefined;
	const awayTeam = event.awayTeamId ? teamsById.get(event.awayTeamId) : undefined;
	const offering = event.offeringId ? offeringsById.get(event.offeringId) : undefined;
	const league = event.leagueId ? leaguesById.get(event.leagueId) : undefined;
	const division = event.divisionId ? divisionsById.get(event.divisionId) : undefined;
	const facility = event.facilityId ? facilitiesById.get(event.facilityId) : undefined;
	const facilityArea = event.facilityAreaId
		? facilityAreasById.get(event.facilityAreaId)
		: undefined;

	const homeTeamName = homeTeam?.name?.trim() || 'TBD';
	const awayTeamName = awayTeam?.name?.trim() || 'TBD';
	const offeringName = offering?.name?.trim() || 'General';
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

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!platform?.env?.DB) {
		return {
			clientId: null,
			generatedAt: new Date().toISOString(),
			summary: {
				total: 0,
				live: 0,
				scheduled: 0,
				completed: 0,
				needsAttention: 0
			},
			events: [] as ScheduleEvent[],
			offeringOptions: [] as OptionCount[],
			statusOptions: [] as OptionCount[],
			error: 'Database not configured'
		};
	}

	const db = new DatabaseOperations(platform);
	await ensureDefaultClient(db);
	const clientId = resolveClientId(locals);

	try {
		const [events, teams, offerings, leagues, divisions, facilities, facilityAreas] =
			await Promise.all([
				db.events.getAll(clientId),
				db.teams.getAll(),
				db.offerings.getByClientId(clientId),
				db.leagues.getByClientId(clientId),
				db.divisions.getAll(),
				db.facilities.getAll(clientId),
				db.facilityAreas.getAll(clientId)
			]);

		const clientTeams = teams.filter((team) => team.clientId === clientId);
		const clientDivisionIds = new Set(clientTeams.map((team) => team.divisionId));
		const clientDivisions = divisions.filter((division) => {
			if (!division.id) return false;
			if (division.leagueId && leagues.some((league) => league.id === division.leagueId))
				return true;
			return clientDivisionIds.has(division.id);
		});

		const teamsById = mapById(clientTeams);
		const offeringsById = mapById(
			offerings.filter((offering): offering is Offering & { id: string } => Boolean(offering.id))
		);
		const leaguesById = mapById(
			leagues.filter((league): league is League & { id: string } => Boolean(league.id))
		);
		const divisionsById = mapById(
			clientDivisions.filter((division): division is Division & { id: string } =>
				Boolean(division.id)
			)
		);
		const facilitiesById = mapById(
			facilities.filter((facility): facility is Facility & { id: string } => Boolean(facility.id))
		);
		const facilityAreasById = mapById(
			facilityAreas.filter((area): area is FacilityArea & { id: string } => Boolean(area.id))
		);

		const activeEvents = events.filter((event) => event.isActive !== 0);
		const scheduleEvents = activeEvents
			.map((event) =>
				buildScheduleEvent(
					event,
					teamsById,
					offeringsById,
					leaguesById,
					divisionsById,
					facilitiesById,
					facilityAreasById
				)
			)
			.sort((a, b) => {
				const startDiff = toTimestamp(a.scheduledStartAt) - toTimestamp(b.scheduledStartAt);
				if (startDiff !== 0) return startDiff;
				const scoreDiff = b.scoreSortValue - a.scoreSortValue;
				if (scoreDiff !== 0) return scoreDiff;
				return a.matchup.localeCompare(b.matchup);
			});

		const summary = {
			total: scheduleEvents.length,
			live: scheduleEvents.filter((event) => event.status === 'in_progress').length,
			scheduled: scheduleEvents.filter((event) => event.status === 'scheduled').length,
			completed: scheduleEvents.filter((event) => event.status === 'completed').length,
			needsAttention: scheduleEvents.filter(
				(event) => event.status === 'cancelled' || event.status === 'postponed'
			).length
		};

		const offeringOptions = toOptionCounts(scheduleEvents.map((event) => event.offeringName));
		const statusOptions = toOptionCounts(scheduleEvents.map((event) => event.statusLabel));

		return {
			clientId,
			generatedAt: new Date().toISOString(),
			summary,
			events: scheduleEvents,
			offeringOptions,
			statusOptions
		};
	} catch (err) {
		console.error('Failed to load schedule page:', err);
		return {
			clientId,
			generatedAt: new Date().toISOString(),
			summary: {
				total: 0,
				live: 0,
				scheduled: 0,
				completed: 0,
				needsAttention: 0
			},
			events: [] as ScheduleEvent[],
			offeringOptions: [] as OptionCount[],
			statusOptions: [] as OptionCount[],
			error: 'Unable to load schedule right now'
		};
	}
};
