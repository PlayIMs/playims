import type { Event } from '$lib/database/schema/events';
import type { Facility } from '$lib/database/schema/facilities';
import type { FacilityArea } from '$lib/database/schema/facility-areas';
import type { League } from '$lib/database/schema/leagues';
import type { Division } from '$lib/database/schema/divisions';
import type { Offering } from '$lib/database/schema/offerings';
import type { Season } from '$lib/database/schema/seasons';
import type { Team } from '$lib/database/schema/teams';
import type { ScheduleEventRecord, ScheduleStatus } from '$lib/utils/schedule-page';

export type ScheduleCreateEventOptions = {
	seasons: Array<{
		id: string;
		name: string;
		isCurrent: boolean;
	}>;
	offerings: Array<{
		id: string;
		seasonId: string | null;
		name: string;
	}>;
	leagues: Array<{
		id: string;
		seasonId: string | null;
		offeringId: string | null;
		name: string;
	}>;
	divisions: Array<{
		id: string;
		leagueId: string | null;
		name: string;
	}>;
	teams: Array<{
		id: string;
		divisionId: string | null;
		name: string;
	}>;
	facilities: Array<{
		id: string;
		name: string;
	}>;
	facilityAreas: Array<{
		id: string;
		facilityId: string | null;
		name: string;
	}>;
};

const STATUS_LABELS: Record<ScheduleStatus, string> = {
	scheduled: 'Scheduled',
	in_progress: 'Live',
	completed: 'Completed',
	cancelled: 'Cancelled',
	postponed: 'Postponed',
	other: 'Other'
};

export function normalizeScheduleStatus(value: string | null): ScheduleStatus {
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

export function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
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

export function resolveDefaultSeasonId(seasons: Season[]): string | null {
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

export function buildScheduleEvent(
	event: Event,
	teamsById: Map<string, Team>,
	offeringsById: Map<string, Offering>,
	seasonsById: Map<string, Season>,
	leaguesById: Map<string, League>,
	divisionsById: Map<string, Division>,
	facilitiesById: Map<string, Facility>,
	facilityAreasById: Map<string, FacilityArea>
): ScheduleEventRecord {
	const status = normalizeScheduleStatus(event.status ?? null);
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
		seasonSlug: season?.slug?.trim() || null,
		offeringId: event.offeringId ?? null,
		offeringName,
		offeringSlug: offering?.slug?.trim() || null,
		leagueId: event.leagueId ?? null,
		leagueName,
		leagueSlug: league?.slug?.trim() || null,
		divisionId: event.divisionId ?? null,
		divisionName,
		divisionSlug: division?.slug?.trim() || null,
		homeTeamId: event.homeTeamId ?? null,
		homeTeamName,
		homeTeamSlug: homeTeam?.slug?.trim() || null,
		awayTeamId: event.awayTeamId ?? null,
		awayTeamName,
		awayTeamSlug: awayTeam?.slug?.trim() || null,
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

export function buildScheduleCreateEventOptions(input: {
	seasons: Season[];
	offerings: Offering[];
	leagues: League[];
	divisions: Division[];
	teams: Team[];
	facilities: Facility[];
	facilityAreas: FacilityArea[];
}): ScheduleCreateEventOptions {
	return {
		seasons: input.seasons
			.filter((season): season is Season & { id: string; name: string } =>
				Boolean(season.id && season.name)
			)
			.filter((season) => season.isActive !== 0 || season.isCurrent === 1)
			.map((season) => ({
				id: season.id,
				name: season.name.trim(),
				isCurrent: season.isCurrent === 1
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		offerings: input.offerings
			.filter((offering): offering is Offering & { id: string; name: string } =>
				Boolean(offering.id && offering.name)
			)
			.filter((offering) => offering.isActive !== 0)
			.map((offering) => ({
				id: offering.id,
				seasonId: offering.seasonId ?? null,
				name: offering.name.trim()
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		leagues: input.leagues
			.filter((league): league is League & { id: string; name: string } =>
				Boolean(league.id && league.name)
			)
			.filter((league) => league.isActive !== 0)
			.map((league) => ({
				id: league.id,
				seasonId: league.seasonId ?? null,
				offeringId: league.offeringId ?? null,
				name: league.name.trim()
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		divisions: input.divisions
			.filter((division): division is Division & { id: string; name: string } =>
				Boolean(division.id && division.name)
			)
			.filter((division) => division.isActive !== 0)
			.map((division) => ({
				id: division.id,
				leagueId: division.leagueId ?? null,
				name: division.name.trim()
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		teams: input.teams
			.filter((team): team is Team & { id: string; name: string } => Boolean(team.id && team.name))
			.filter((team) => team.isActive !== 0)
			.map((team) => ({
				id: team.id,
				divisionId: team.divisionId ?? null,
				name: team.name.trim()
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		facilities: input.facilities
			.filter((facility): facility is Facility & { id: string; name: string } =>
				Boolean(facility.id && facility.name)
			)
			.filter((facility) => facility.isActive !== 0)
			.map((facility) => ({
				id: facility.id,
				name: facility.name.trim()
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		facilityAreas: input.facilityAreas
			.filter((area): area is FacilityArea & { id: string; name: string } =>
				Boolean(area.id && area.name)
			)
			.filter((area) => area.isActive !== 0)
			.map((area) => ({
				id: area.id,
				facilityId: area.facilityId ?? null,
				name: area.name.trim()
			}))
			.sort((a, b) => a.name.localeCompare(b.name))
	};
}
