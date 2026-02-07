import { DatabaseOperations } from '$lib/database';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import type { Division } from '$lib/database/schema/divisions';
import type { Event } from '$lib/database/schema/events';
import type { FacilityArea } from '$lib/database/schema/facility-areas';
import type { Facility } from '$lib/database/schema/facilities';
import type { League } from '$lib/database/schema/leagues';
import type { Sport } from '$lib/database/schema/sports';
import type { Team } from '$lib/database/schema/teams';
import type { PageServerLoad } from './$types';

type RegistrationStatus = 'open' | 'upcoming' | 'closed' | 'unknown';
type SeasonStatus = 'upcoming' | 'in_season' | 'completed' | 'unknown';
type TournamentStatus = 'upcoming' | 'active' | 'completed' | 'planned';
type ParticipationType = 'team' | 'individual';
type DeadlineUrgency = 'critical' | 'warning' | 'normal' | 'pending' | 'closed';

interface ActivityCard {
	id: string;
	leagueId: string | null;
	sportId: string | null;
	offeringType: 'league' | 'tournament';
	sportName: string;
	leagueName: string;
	seasonLabel: string;
	season: string | null;
	year: number | null;
	description: string | null;
	gender: string | null;
	skillLevel: string | null;
	participationType: ParticipationType;
	registrationStatus: RegistrationStatus;
	registrationStatusLabel: string;
	registrationStart: string | null;
	registrationEnd: string | null;
	daysUntilRegistrationDeadline: number | null;
	seasonStatus: SeasonStatus;
	seasonStatusLabel: string;
	seasonStart: string | null;
	seasonEnd: string | null;
	postseasonStart: string | null;
	postseasonEnd: string | null;
	hasTournament: boolean;
	paymentRequired: boolean;
	paymentModel: 'captain_checkout' | 'individual_checkout';
	paymentModelLabel: string;
	paymentSummary: string;
	paymentDueAt: string | null;
	minPlayers: number | null;
	maxPlayers: number | null;
	teamCount: number;
	divisionCount: number;
	eventCount: number;
	upcomingEventCount: number;
	teamCapacity: number | null;
	spotsRemaining: number | null;
	isLocked: boolean;
	isActive: boolean;
}

interface DeadlineItem {
	id: string;
	activityId: string;
	leagueName: string;
	sportName: string;
	registrationStatus: RegistrationStatus;
	registrationStatusLabel: string;
	registrationEnd: string;
	daysUntilDeadline: number;
	urgency: DeadlineUrgency;
}

interface CompetitionItem {
	id: string;
	leagueId: string | null;
	leagueName: string;
	sportName: string;
	matchup: string;
	location: string;
	startsAt: string;
	endsAt: string | null;
	status: string;
	statusLabel: string;
	weekNumber: number | null;
	roundLabel: string | null;
	isTournament: boolean;
}

interface TournamentItem {
	id: string;
	activityId: string;
	leagueName: string;
	sportName: string;
	seasonLabel: string;
	status: TournamentStatus;
	statusLabel: string;
	startsAt: string | null;
	endsAt: string | null;
	registeredTeams: number;
	teamCapacity: number | null;
	spotsRemaining: number | null;
	registrationStatus: RegistrationStatus;
	registrationStatusLabel: string;
}

interface PaymentPolicy {
	id: 'team' | 'individual';
	title: string;
	checkoutFlow: string;
	requirement: string;
	acceptedMethods: string;
	enforcement: string;
}

interface OptionCount {
	value: string;
	label: string;
	count: number;
}

interface SummaryStats {
	totalActivities: number;
	openRegistration: number;
	closingThisWeek: number;
	inSeason: number;
	upcomingCompetitions: number;
	tournamentBrackets: number;
	teamActivities: number;
	individualActivities: number;
	registeredTeams: number;
	paymentDueThisWeek: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;
const OPEN_WARNING_DAYS = 7;

const REGISTRATION_LABELS: Record<RegistrationStatus, string> = {
	open: 'Open',
	upcoming: 'Upcoming',
	closed: 'Closed',
	unknown: 'TBD'
};

const SEASON_LABELS: Record<SeasonStatus, string> = {
	upcoming: 'Upcoming',
	in_season: 'In Season',
	completed: 'Completed',
	unknown: 'TBD'
};

const TOURNAMENT_LABELS: Record<TournamentStatus, string> = {
	upcoming: 'Upcoming',
	active: 'Active',
	completed: 'Completed',
	planned: 'Planned'
};

const PAYMENT_POLICIES: PaymentPolicy[] = [
	{
		id: 'team',
		title: 'Team Registrations',
		checkoutFlow: 'Captain checkout',
		requirement:
			'Team captain payment is required to lock the team slot before schedules are finalized.',
		acceptedMethods: 'Card, campus billing, and approved departmental transfer',
		enforcement: 'Unpaid teams at deadline are moved to waitlist priority.'
	},
	{
		id: 'individual',
		title: 'Individual Registrations',
		checkoutFlow: 'Participant checkout',
		requirement:
			'Each participant must complete payment before being seeded into tournament pools or ladders.',
		acceptedMethods: 'Card and campus billing',
		enforcement: 'Unpaid registrations are released before bracket publish.'
	}
];

function parseDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysFromNow(target: Date, now: Date): number {
	const diff = target.getTime() - now.getTime();
	if (diff >= 0) return Math.ceil(diff / DAY_MS);
	return Math.floor(diff / DAY_MS);
}

function normalizeEventStatus(value: string | null | undefined): string {
	if (!value) return 'scheduled';
	return value.trim().toLowerCase().replace(/-/g, '_');
}

function titleCase(value: string): string {
	return value
		.split('_')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function eventStatusLabel(value: string): string {
	if (value === 'in_progress') return 'Live';
	if (value === 'completed') return 'Final';
	if (value === 'scheduled') return 'Scheduled';
	if (value === 'cancelled') return 'Cancelled';
	if (value === 'postponed') return 'Postponed';
	return titleCase(value);
}

function registrationStatusFromDates(
	now: Date,
	start: Date | null,
	end: Date | null
): RegistrationStatus {
	if (!start && !end) return 'unknown';
	if (start && now < start) return 'upcoming';
	if (end && now > end) return 'closed';
	return 'open';
}

function seasonStatusFromDates(now: Date, start: Date | null, end: Date | null): SeasonStatus {
	if (!start && !end) return 'unknown';
	if (start && now < start) return 'upcoming';
	if (end && now > end) return 'completed';
	return 'in_season';
}

function tournamentStatusFromDates(
	now: Date,
	start: Date | null,
	end: Date | null
): TournamentStatus {
	if (!start && !end) return 'planned';
	if (start && now < start) return 'upcoming';
	if (end && now > end) return 'completed';
	if (start && now >= start) return 'active';
	return 'planned';
}

function inferParticipationType(sport: Sport | undefined): ParticipationType {
	const minPlayers = sport?.minPlayers ?? null;
	const maxPlayers = sport?.maxPlayers ?? null;
	if (minPlayers === 1 && maxPlayers === 1) return 'individual';
	if (minPlayers === 1 && (maxPlayers ?? 1) <= 2) return 'individual';
	return 'team';
}

function formatSeasonLabel(league: League): string {
	const season = league.season?.trim() ?? '';
	const year = league.year ?? null;
	if (season && year) return `${season} ${year}`;
	if (season) return season;
	if (year) return `${year} Season`;
	return 'Current Season';
}

function toOptionCounts(values: string[]): OptionCount[] {
	const counter = new Map<string, number>();
	for (const value of values) {
		const safe = value.trim();
		if (!safe) continue;
		counter.set(safe, (counter.get(safe) ?? 0) + 1);
	}

	return Array.from(counter.entries())
		.map(([value, count]) => ({ value, label: value, count }))
		.sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count;
			return a.label.localeCompare(b.label);
		});
}

function mapById<T extends { id: string | null }>(items: T[]): Map<string, T> {
	const mapped = new Map<string, T>();
	for (const item of items) {
		if (!item.id) continue;
		mapped.set(item.id, item);
	}
	return mapped;
}

function isoFromNow(now: Date, daysFromToday: number): string {
	const target = new Date(now.getTime() + daysFromToday * DAY_MS);
	target.setUTCHours(12, 0, 0, 0);
	return target.toISOString();
}

function createDemoActivity(
	now: Date,
	overrides: Partial<ActivityCard> & Pick<ActivityCard, 'id' | 'sportName' | 'leagueName'>
): ActivityCard {
	const base: ActivityCard = {
		id: overrides.id,
		leagueId: overrides.id,
		sportId: `sport-${overrides.sportName.toLowerCase().replace(/\s+/g, '-')}`,
		offeringType: 'league',
		sportName: overrides.sportName,
		leagueName: overrides.leagueName,
		seasonLabel: 'Spring 2026',
		season: 'Spring',
		year: 2026,
		description: 'Demo tournament offering for intramural registration UX preview.',
		gender: null,
		skillLevel: null,
		participationType: 'team',
		registrationStatus: 'open',
		registrationStatusLabel: REGISTRATION_LABELS.open,
		registrationStart: isoFromNow(now, -10),
		registrationEnd: isoFromNow(now, 10),
		daysUntilRegistrationDeadline: 10,
		seasonStatus: 'upcoming',
		seasonStatusLabel: SEASON_LABELS.upcoming,
		seasonStart: isoFromNow(now, 21),
		seasonEnd: isoFromNow(now, 70),
		postseasonStart: isoFromNow(now, 71),
		postseasonEnd: isoFromNow(now, 84),
		hasTournament: false,
		paymentRequired: true,
		paymentModel: 'captain_checkout',
		paymentModelLabel: 'Captain checkout required',
		paymentSummary: 'Captain payment secures roster placement before bracket release.',
		paymentDueAt: isoFromNow(now, 10),
		minPlayers: 5,
		maxPlayers: 12,
		teamCount: 8,
		divisionCount: 1,
		eventCount: 0,
		upcomingEventCount: 0,
		teamCapacity: 12,
		spotsRemaining: 4,
		isLocked: false,
		isActive: true
	};

	const merged = { ...base, ...overrides };
	const registrationStartDate = parseDate(merged.registrationStart);
	const registrationEndDate = parseDate(merged.registrationEnd);
	const seasonStartDate = parseDate(merged.seasonStart);
	const seasonEndDate = parseDate(merged.seasonEnd);
	const registrationStatus = registrationStatusFromDates(
		now,
		registrationStartDate,
		registrationEndDate
	);
	const seasonStatus = seasonStatusFromDates(now, seasonStartDate, seasonEndDate);

	return {
		...merged,
		registrationStatus,
		registrationStatusLabel: REGISTRATION_LABELS[registrationStatus],
		daysUntilRegistrationDeadline: registrationEndDate
			? daysFromNow(registrationEndDate, now)
			: null,
		seasonStatus,
		seasonStatusLabel: SEASON_LABELS[seasonStatus],
		paymentDueAt: merged.paymentDueAt ?? merged.registrationEnd ?? merged.seasonStart
	};
}

function buildDemoActivities(now: Date): ActivityCard[] {
	const sports = [
		'Basketball',
		'Soccer',
		'Volleyball',
		'Flag Football',
		'Floor Hockey',
		'Softball'
	];
	const leagueVariants = [
		{
			gender: 'mens',
			label: "Men's",
			skillLevel: 'competitive'
		},
		{
			gender: 'womens',
			label: "Women's",
			skillLevel: 'recreational'
		},
		{
			gender: 'corec',
			label: 'CoRec',
			skillLevel: 'all'
		},
		{
			gender: 'unified',
			label: 'Unified',
			skillLevel: 'intermediate'
		}
	] as const;

	const activities: ActivityCard[] = [];
	let dayCursor = 3;
	let activityIndex = 0;
	const openNowSports = new Set(['Basketball', 'Soccer']);
	const concludedSports = new Set(['Floor Hockey', 'Softball']);

	for (const sport of sports) {
		for (const variant of leagueVariants) {
			activityIndex += 1;
			const teamCapacity = 12 + (activityIndex % 5) * 2;
			let teamCount = Math.max(2, teamCapacity - (3 + (activityIndex % 4)));
			const shouldBeOpenNow = openNowSports.has(sport);
			const shouldBeConcluded = concludedSports.has(sport);
			const registrationStartOffset = shouldBeConcluded
				? -(95 + activityIndex)
				: shouldBeOpenNow
					? -(18 - (activityIndex % 5))
					: dayCursor;
			const registrationEndOffset = shouldBeConcluded
				? -(72 + (activityIndex % 8))
				: shouldBeOpenNow
					? 18 + (activityIndex % 6)
					: dayCursor + 16 + (activityIndex % 3);
			const seasonStartOffset = registrationEndOffset + 9;
			const seasonEndOffset = seasonStartOffset + 34;
			const postseasonStartOffset = seasonEndOffset + 2;
			const postseasonEndOffset = postseasonStartOffset + 7;
			const safeSportSlug = sport.toLowerCase().replace(/\s+/g, '-');
			const safeVariantSlug = variant.label.toLowerCase().replace(/[^a-z]+/g, '-');
			const isBasketballMens = sport === 'Basketball' && variant.gender === 'mens';
			if (isBasketballMens) {
				teamCount = teamCapacity;
			}

			activities.push(
				createDemoActivity(now, {
					id: `demo-${safeSportSlug}-${safeVariantSlug}-s26`,
					sportName: sport,
					leagueName: `${variant.label} League`,
					offeringType: 'league' as const,
					season: 'Spring',
					year: 2026,
					seasonLabel: 'Spring 2026',
					gender: variant.gender,
					skillLevel: variant.skillLevel,
					teamCapacity,
					teamCount,
					spotsRemaining: Math.max(teamCapacity - teamCount, 0),
					registrationStart: isoFromNow(now, registrationStartOffset),
					registrationEnd: isoFromNow(now, registrationEndOffset),
					seasonStart: isoFromNow(now, seasonStartOffset),
					seasonEnd: isoFromNow(now, seasonEndOffset),
					postseasonStart: isoFromNow(now, postseasonStartOffset),
					postseasonEnd: isoFromNow(now, postseasonEndOffset),
					isLocked: false,
					hasTournament: false
				})
			);

			dayCursor += 2;
		}
	}

	const tournamentSports = ['Battleship', 'Cornhole', 'Doubles Pickleball', 'Spikeball'];
	const tournamentGroups = ["Men's", "Women's", 'Open', 'CoRec'] as const;
	const concludedTournamentSports = new Set(['Battleship']);
	let tournamentCursor = 5;
	let tournamentIndex = 0;

	for (const sport of tournamentSports) {
		for (const group of tournamentGroups) {
			tournamentIndex += 1;
			const safeSportSlug = sport.toLowerCase().replace(/\s+/g, '-');
			const safeGroupSlug = group.toLowerCase().replace(/[^a-z0-9]+/g, '-');
			const isConcluded = concludedTournamentSports.has(sport);
			const registrationStartOffset = isConcluded ? -(84 + tournamentIndex) : tournamentCursor - 8;
			const registrationEndOffset = isConcluded
				? -(56 + (tournamentIndex % 6))
				: tournamentCursor + 9 + (tournamentIndex % 4);
			const tournamentStartOffset = isConcluded
				? registrationEndOffset + 10
				: tournamentCursor + 18 + (tournamentIndex % 3);
			const isSingleDayTournament = tournamentIndex % 3 === 0;
			const tournamentEndOffset = isSingleDayTournament
				? tournamentStartOffset
				: tournamentStartOffset + 1 + (tournamentIndex % 2);
			const teamCapacity = sport.includes('Pickleball') ? 24 : 20;
			const teamCount = Math.max(4, teamCapacity - (4 + (tournamentIndex % 6)));

			activities.push(
				createDemoActivity(now, {
					id: `demo-${safeSportSlug}-${safeGroupSlug}-tournament-s26`,
					sportName: sport,
					leagueName: group,
					offeringType: 'tournament',
					season: 'Spring',
					year: 2026,
					seasonLabel: 'Spring 2026',
					gender:
						group === "Men's"
							? 'mens'
							: group === "Women's"
								? 'womens'
								: group === 'CoRec'
									? 'corec'
									: group === 'Open'
										? 'open'
										: null,
					skillLevel: sport.includes('Pickleball') ? 'recreational' : 'competitive',
					participationType: 'team',
					paymentModel: 'captain_checkout',
					paymentModelLabel: 'Captain checkout required',
					paymentSummary: 'Captain payment secures tournament group placement.',
					teamCapacity,
					teamCount,
					spotsRemaining: Math.max(teamCapacity - teamCount, 0),
					registrationStart: isoFromNow(now, registrationStartOffset),
					registrationEnd: isoFromNow(now, registrationEndOffset),
					seasonStart: isoFromNow(now, tournamentStartOffset),
					seasonEnd: isoFromNow(now, tournamentEndOffset),
					postseasonStart: isoFromNow(now, tournamentStartOffset),
					postseasonEnd: isoFromNow(now, tournamentEndOffset),
					hasTournament: true,
					isLocked: false
				})
			);

			tournamentCursor += 2;
		}
	}

	return activities;
}

function withDemoIfNoTournamentActivities(source: ActivityCard[], now: Date): ActivityCard[] {
	const hasActiveTournament = source.some(
		(activity) => activity.offeringType === 'tournament' && activity.isActive
	);
	if (hasActiveTournament) return source;
	return buildDemoActivities(now);
}

function buildFallbackPayload(error: string) {
	const now = new Date();
	const activities = buildDemoActivities(now);
	return {
		clientId: null as string | null,
		generatedAt: new Date().toISOString(),
		summary: {
			totalActivities: activities.length,
			openRegistration: activities.filter((activity) => activity.registrationStatus === 'open')
				.length,
			closingThisWeek: activities.filter(
				(activity) =>
					activity.registrationStatus === 'open' &&
					activity.daysUntilRegistrationDeadline !== null &&
					activity.daysUntilRegistrationDeadline >= 0 &&
					activity.daysUntilRegistrationDeadline <= OPEN_WARNING_DAYS
			).length,
			inSeason: activities.filter((activity) => activity.seasonStatus === 'in_season').length,
			upcomingCompetitions: 0,
			tournamentBrackets: activities.filter((activity) => activity.hasTournament).length,
			teamActivities: activities.filter((activity) => activity.participationType === 'team').length,
			individualActivities: activities.filter(
				(activity) => activity.participationType === 'individual'
			).length,
			registeredTeams: activities.reduce((sum, activity) => sum + activity.teamCount, 0),
			paymentDueThisWeek: activities.filter((activity) => {
				const dueAt = parseDate(activity.paymentDueAt);
				if (!dueAt) return false;
				const daysUntilDue = daysFromNow(dueAt, now);
				return daysUntilDue >= 0 && daysUntilDue <= OPEN_WARNING_DAYS;
			}).length
		} satisfies SummaryStats,
		activities,
		deadlines: activities
			.filter((activity) => activity.registrationEnd)
			.map((activity) => ({
				id: `deadline-${activity.id}`,
				activityId: activity.id,
				leagueName: activity.leagueName,
				sportName: activity.sportName,
				registrationStatus: activity.registrationStatus,
				registrationStatusLabel: activity.registrationStatusLabel,
				registrationEnd: activity.registrationEnd ?? '',
				daysUntilDeadline: activity.registrationEnd
					? daysFromNow(new Date(activity.registrationEnd), now)
					: 0,
				urgency: 'normal'
			}))
			.slice(0, 8),
		upcomingCompetitions: [] as CompetitionItem[],
		tournaments: activities.map((activity) => ({
			id: `tournament-${activity.id}`,
			activityId: activity.id,
			leagueName: activity.leagueName,
			sportName: activity.sportName,
			seasonLabel: activity.seasonLabel,
			status: tournamentStatusFromDates(
				now,
				parseDate(activity.postseasonStart),
				parseDate(activity.postseasonEnd)
			),
			statusLabel:
				TOURNAMENT_LABELS[
					tournamentStatusFromDates(
						now,
						parseDate(activity.postseasonStart),
						parseDate(activity.postseasonEnd)
					)
				],
			startsAt: activity.postseasonStart,
			endsAt: activity.postseasonEnd,
			registeredTeams: activity.teamCount,
			teamCapacity: activity.teamCapacity,
			spotsRemaining: activity.spotsRemaining,
			registrationStatus: activity.registrationStatus,
			registrationStatusLabel: activity.registrationStatusLabel
		})),
		sportOptions: toOptionCounts(activities.map((activity) => activity.sportName)),
		registrationOptions: toOptionCounts(
			activities.map((activity) => activity.registrationStatusLabel)
		),
		seasonOptions: toOptionCounts(activities.map((activity) => activity.seasonStatusLabel)),
		paymentPolicies: PAYMENT_POLICIES,
		error
	};
}

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!platform?.env?.DB) {
		return buildFallbackPayload('Database not configured');
	}

	const db = new DatabaseOperations(platform);
	await ensureDefaultClient(db);
	const clientId = resolveClientId(locals);
	const now = new Date();
	const nowMs = now.getTime();

	try {
		const [sports, leagues, divisions, teams, events, facilities, facilityAreas] =
			await Promise.all([
				db.sports.getByClientId(clientId),
				db.leagues.getByClientId(clientId),
				db.divisions.getAll(),
				db.teams.getAll(),
				db.events.getAll(clientId),
				db.facilities.getAll(clientId),
				db.facilityAreas.getAll(clientId)
			]);

		const leagueIds = new Set(
			leagues.map((league) => league.id).filter((id): id is string => Boolean(id))
		);

		const clientDivisions = divisions.filter(
			(division): division is Division & { id: string; leagueId: string } =>
				Boolean(division.id && division.leagueId && leagueIds.has(division.leagueId))
		);
		const clientTeams = teams.filter((team): team is Team & { id: string; divisionId: string } =>
			Boolean(team.id && team.divisionId && team.clientId === clientId && team.isActive !== 0)
		);
		const activeEvents = events.filter((event): event is Event & { id: string } =>
			Boolean(event.id && event.isActive !== 0)
		);

		const sportsById = mapById(sports);
		const leaguesById = mapById(leagues);
		const teamsById = mapById(clientTeams);
		const facilitiesById = mapById(
			facilities.filter((facility): facility is Facility & { id: string } => Boolean(facility.id))
		);
		const facilityAreasById = mapById(
			facilityAreas.filter((area): area is FacilityArea & { id: string } => Boolean(area.id))
		);

		const divisionIdsByLeague = new Map<string, string[]>();
		const divisionCountByLeague = new Map<string, number>();
		const teamCapacityByLeague = new Map<string, number>();

		for (const division of clientDivisions) {
			const leagueId = division.leagueId;
			const existing = divisionIdsByLeague.get(leagueId) ?? [];
			existing.push(division.id);
			divisionIdsByLeague.set(leagueId, existing);
			divisionCountByLeague.set(leagueId, (divisionCountByLeague.get(leagueId) ?? 0) + 1);

			if ((division.maxTeams ?? 0) > 0) {
				teamCapacityByLeague.set(
					leagueId,
					(teamCapacityByLeague.get(leagueId) ?? 0) + (division.maxTeams ?? 0)
				);
			}
		}

		const teamCountByDivision = new Map<string, number>();
		for (const team of clientTeams) {
			teamCountByDivision.set(team.divisionId, (teamCountByDivision.get(team.divisionId) ?? 0) + 1);
		}

		const teamCountByLeague = new Map<string, number>();
		for (const [leagueId, divisionIds] of divisionIdsByLeague.entries()) {
			let count = 0;
			for (const divisionId of divisionIds) {
				count += teamCountByDivision.get(divisionId) ?? 0;
			}
			teamCountByLeague.set(leagueId, count);
		}

		const eventCountByLeague = new Map<string, number>();
		const upcomingEventCountByLeague = new Map<string, number>();

		for (const event of activeEvents) {
			if (!event.leagueId) continue;
			if (!leagueIds.has(event.leagueId)) continue;

			eventCountByLeague.set(event.leagueId, (eventCountByLeague.get(event.leagueId) ?? 0) + 1);

			const start = parseDate(event.scheduledStartAt);
			const status = normalizeEventStatus(event.status);
			const isUpcoming =
				start &&
				start.getTime() >= nowMs &&
				status !== 'completed' &&
				status !== 'cancelled' &&
				status !== 'postponed';

			if (isUpcoming) {
				upcomingEventCountByLeague.set(
					event.leagueId,
					(upcomingEventCountByLeague.get(event.leagueId) ?? 0) + 1
				);
			}
		}

		const activities: ActivityCard[] = leagues
			.map<ActivityCard>((league, index) => {
				const resolvedId = league.id ?? `league-${index + 1}`;
				const sport = league.sportId ? sportsById.get(league.sportId) : undefined;
				const participationType = inferParticipationType(sport);

				const registrationStartDate = parseDate(league.regStartDate);
				const registrationEndDate = parseDate(league.regEndDate);
				const registrationStatus = registrationStatusFromDates(
					now,
					registrationStartDate,
					registrationEndDate
				);
				const daysUntilRegistrationDeadline = registrationEndDate
					? daysFromNow(registrationEndDate, now)
					: null;

				const seasonStartDate = parseDate(league.seasonStartDate);
				const seasonEndDate = parseDate(league.seasonEndDate);
				const seasonStatus = seasonStatusFromDates(now, seasonStartDate, seasonEndDate);

				const leagueId = league.id ?? '';
				const teamCount = teamCountByLeague.get(leagueId) ?? 0;
				const teamCapacity = teamCapacityByLeague.get(leagueId) ?? null;
				const spotsRemaining = teamCapacity !== null ? Math.max(teamCapacity - teamCount, 0) : null;

				const paymentModel: ActivityCard['paymentModel'] =
					participationType === 'team' ? 'captain_checkout' : 'individual_checkout';
				const paymentModelLabel =
					participationType === 'team'
						? 'Captain checkout required'
						: 'Individual checkout required';
				const paymentSummary =
					participationType === 'team'
						? 'Captain payment secures roster placement before schedule release.'
						: 'Each participant completes checkout before bracket placement.';

				return {
					id: resolvedId,
					leagueId: league.id ?? null,
					sportId: league.sportId ?? null,
					offeringType: 'league',
					sportName: sport?.name?.trim() || 'General Recreation',
					leagueName: league.name?.trim() || 'Untitled League',
					seasonLabel: formatSeasonLabel(league),
					season: league.season ?? null,
					year: league.year ?? null,
					description: league.description ?? sport?.description ?? null,
					gender: league.gender ?? null,
					skillLevel: league.skillLevel ?? null,
					participationType,
					registrationStatus,
					registrationStatusLabel: REGISTRATION_LABELS[registrationStatus],
					registrationStart: league.regStartDate ?? null,
					registrationEnd: league.regEndDate ?? null,
					daysUntilRegistrationDeadline,
					seasonStatus,
					seasonStatusLabel: SEASON_LABELS[seasonStatus],
					seasonStart: league.seasonStartDate ?? null,
					seasonEnd: league.seasonEndDate ?? null,
					postseasonStart: league.postseasonStartDate ?? null,
					postseasonEnd: league.postseasonEndDate ?? null,
					hasTournament: league.hasPostseason === 1,
					paymentRequired: true,
					paymentModel,
					paymentModelLabel,
					paymentSummary,
					paymentDueAt: league.regEndDate ?? league.seasonStartDate ?? null,
					minPlayers: sport?.minPlayers ?? null,
					maxPlayers: sport?.maxPlayers ?? null,
					teamCount,
					divisionCount: divisionCountByLeague.get(leagueId) ?? 0,
					eventCount: eventCountByLeague.get(leagueId) ?? 0,
					upcomingEventCount: upcomingEventCountByLeague.get(leagueId) ?? 0,
					teamCapacity,
					spotsRemaining,
					isLocked: league.isLocked === 1,
					isActive: league.isActive !== 0
				};
			})
			.sort((a, b) => {
				const statusOrder: Record<RegistrationStatus, number> = {
					open: 0,
					upcoming: 1,
					unknown: 2,
					closed: 3
				};
				const statusDiff = statusOrder[a.registrationStatus] - statusOrder[b.registrationStatus];
				if (statusDiff !== 0) return statusDiff;

				const aEnd = parseDate(a.registrationEnd)?.getTime() ?? Number.POSITIVE_INFINITY;
				const bEnd = parseDate(b.registrationEnd)?.getTime() ?? Number.POSITIVE_INFINITY;
				if (aEnd !== bEnd) return aEnd - bEnd;

				return a.leagueName.localeCompare(b.leagueName);
			});

		const activitiesForView = withDemoIfNoTournamentActivities(activities, now);

		const deadlines: DeadlineItem[] = activitiesForView
			.filter((activity) => activity.registrationEnd)
			.map((activity) => {
				const deadlineDate = parseDate(activity.registrationEnd);
				const daysUntilDeadline = deadlineDate ? daysFromNow(deadlineDate, now) : 0;

				let urgency: DeadlineUrgency = 'normal';
				if (activity.registrationStatus === 'closed') {
					urgency = 'closed';
				} else if (activity.registrationStatus === 'upcoming') {
					urgency = 'pending';
				} else if (daysUntilDeadline <= 2) {
					urgency = 'critical';
				} else if (daysUntilDeadline <= OPEN_WARNING_DAYS) {
					urgency = 'warning';
				}

				return {
					id: `deadline-${activity.id}`,
					activityId: activity.id,
					leagueName: activity.leagueName,
					sportName: activity.sportName,
					registrationStatus: activity.registrationStatus,
					registrationStatusLabel: activity.registrationStatusLabel,
					registrationEnd: activity.registrationEnd ?? '',
					daysUntilDeadline,
					urgency
				};
			})
			.sort((a, b) => {
				const urgencyOrder: Record<DeadlineUrgency, number> = {
					critical: 0,
					warning: 1,
					normal: 2,
					pending: 3,
					closed: 4
				};
				const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
				if (urgencyDiff !== 0) return urgencyDiff;

				const aDate = parseDate(a.registrationEnd)?.getTime() ?? Number.POSITIVE_INFINITY;
				const bDate = parseDate(b.registrationEnd)?.getTime() ?? Number.POSITIVE_INFINITY;
				if (aDate !== bDate) return aDate - bDate;

				return a.leagueName.localeCompare(b.leagueName);
			});

		const sortedCompetitions = activeEvents
			.map((event) => {
				const startsAt = parseDate(event.scheduledStartAt);
				if (!startsAt) return null;
				return { event, startsAt };
			})
			.filter((item): item is { event: Event & { id: string }; startsAt: Date } => Boolean(item))
			.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

		const upcomingCompetitions: CompetitionItem[] = sortedCompetitions
			.filter(({ event, startsAt }) => {
				const normalizedStatus = normalizeEventStatus(event.status);
				if (normalizedStatus === 'cancelled') return false;
				if (normalizedStatus === 'completed' && startsAt.getTime() < nowMs - 2 * 60 * 60 * 1000)
					return false;
				return startsAt.getTime() >= nowMs - 2 * 60 * 60 * 1000;
			})
			.slice(0, 12)
			.map(({ event }) => {
				const homeTeamName = event.homeTeamId
					? teamsById.get(event.homeTeamId)?.name?.trim() || 'TBD'
					: 'TBD';
				const awayTeamName = event.awayTeamId
					? teamsById.get(event.awayTeamId)?.name?.trim() || 'TBD'
					: 'TBD';
				const leagueName =
					(event.leagueId ? leaguesById.get(event.leagueId)?.name : null)?.trim() ||
					'Open Competition';
				const sportName =
					(event.sportId ? sportsById.get(event.sportId)?.name : null)?.trim() || 'Recreation';
				const facilityName =
					(event.facilityId ? facilitiesById.get(event.facilityId)?.name : null)?.trim() ||
					'TBD Facility';
				const areaName =
					(event.facilityAreaId
						? facilityAreasById.get(event.facilityAreaId)?.name
						: null
					)?.trim() || '';
				const location = areaName ? `${facilityName} - ${areaName}` : facilityName;
				const status = normalizeEventStatus(event.status);

				return {
					id: event.id,
					leagueId: event.leagueId ?? null,
					leagueName,
					sportName,
					matchup: `${homeTeamName} vs ${awayTeamName}`,
					location,
					startsAt: event.scheduledStartAt ?? '',
					endsAt: event.scheduledEndAt ?? null,
					status,
					statusLabel: eventStatusLabel(status),
					weekNumber: event.weekNumber ?? null,
					roundLabel: event.roundLabel ?? null,
					isTournament: event.isPostseason === 1
				};
			});

		const tournaments: TournamentItem[] = activitiesForView
			.filter((activity) => activity.hasTournament)
			.map((activity) => {
				const fallbackStart = parseDate(activity.seasonEnd);
				const startsAtDate = parseDate(activity.postseasonStart) ?? fallbackStart;
				const endsAtDate = parseDate(activity.postseasonEnd);
				const status = tournamentStatusFromDates(now, startsAtDate, endsAtDate);

				return {
					id: `tournament-${activity.id}`,
					activityId: activity.id,
					leagueName: activity.leagueName,
					sportName: activity.sportName,
					seasonLabel: activity.seasonLabel,
					status,
					statusLabel: TOURNAMENT_LABELS[status],
					startsAt: startsAtDate?.toISOString() ?? null,
					endsAt: endsAtDate?.toISOString() ?? null,
					registeredTeams: activity.teamCount,
					teamCapacity: activity.teamCapacity,
					spotsRemaining: activity.spotsRemaining,
					registrationStatus: activity.registrationStatus,
					registrationStatusLabel: activity.registrationStatusLabel
				};
			})
			.sort((a, b) => {
				const aStart = parseDate(a.startsAt)?.getTime() ?? Number.POSITIVE_INFINITY;
				const bStart = parseDate(b.startsAt)?.getTime() ?? Number.POSITIVE_INFINITY;
				if (aStart !== bStart) return aStart - bStart;
				return a.leagueName.localeCompare(b.leagueName);
			});

		const paymentDueThisWeek = activitiesForView.filter((activity) => {
			const dueAt = parseDate(activity.paymentDueAt);
			if (!dueAt) return false;
			const daysUntilDue = daysFromNow(dueAt, now);
			return daysUntilDue >= 0 && daysUntilDue <= OPEN_WARNING_DAYS;
		}).length;

		const summary: SummaryStats = {
			totalActivities: activitiesForView.length,
			openRegistration: activitiesForView.filter(
				(activity) => activity.registrationStatus === 'open'
			).length,
			closingThisWeek: activitiesForView.filter(
				(activity) =>
					activity.registrationStatus === 'open' &&
					activity.daysUntilRegistrationDeadline !== null &&
					activity.daysUntilRegistrationDeadline >= 0 &&
					activity.daysUntilRegistrationDeadline <= OPEN_WARNING_DAYS
			).length,
			inSeason: activitiesForView.filter((activity) => activity.seasonStatus === 'in_season')
				.length,
			upcomingCompetitions: upcomingCompetitions.length,
			tournamentBrackets: tournaments.length,
			teamActivities: activitiesForView.filter((activity) => activity.participationType === 'team')
				.length,
			individualActivities: activitiesForView.filter(
				(activity) => activity.participationType === 'individual'
			).length,
			registeredTeams: activitiesForView.reduce((sum, activity) => sum + activity.teamCount, 0),
			paymentDueThisWeek
		};

		return {
			clientId,
			generatedAt: new Date().toISOString(),
			summary,
			activities: activitiesForView,
			deadlines,
			upcomingCompetitions,
			tournaments,
			sportOptions: toOptionCounts(activitiesForView.map((activity) => activity.sportName)),
			registrationOptions: toOptionCounts(
				activitiesForView.map((activity) => activity.registrationStatusLabel)
			),
			seasonOptions: toOptionCounts(
				activitiesForView.map((activity) => activity.seasonStatusLabel)
			),
			paymentPolicies: PAYMENT_POLICIES
		};
	} catch (error) {
		console.error('Failed to load intramural sports page:', error);
		return buildFallbackPayload('Unable to load intramural sports data right now');
	}
};
