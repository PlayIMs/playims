export type OfferingTimelineEventType =
	| 'registration-deadline'
	| 'join-team-deadline'
	| 'season-start'
	| 'season-end';

export interface OfferingTimelineLeagueSource {
	leagueId: string;
	leagueName: string;
	categoryLabel: string;
	offeringName: string;
	offeringSlug: string;
	registrationDeadlineDate: string | null;
	registrationDeadlineLabel: string;
	joinTeamDate: string | null;
	joinTeamLabel: string;
	seasonStartDate: string | null;
	seasonStartLabel: string;
	seasonEndDate: string | null;
	seasonEndLabel: string;
}

export interface OfferingTimelineEvent {
	id: string;
	type: OfferingTimelineEventType;
	date: string;
	ms: number;
	label: string;
	leagueId: string;
	leagueName: string;
	categoryLabel: string;
	offeringName: string;
	offeringSlug: string;
	isPast: boolean;
}

export interface OfferingTimelineGroup {
	id: string;
	date: string;
	ms: number;
	isPast: boolean;
	events: OfferingTimelineEvent[];
}

const TIMELINE_EVENT_PRIORITY: Record<OfferingTimelineEventType, number> = {
	'registration-deadline': 0,
	'join-team-deadline': 1,
	'season-start': 2,
	'season-end': 3
};

function parseTimelineDate(value: string | null): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function createTimelineGroupId(date: string): string {
	return `offering-timeline-group-${date.replace(/[^a-zA-Z0-9]+/g, '-')}`;
}

function compareTimelineEvents(a: OfferingTimelineEvent, b: OfferingTimelineEvent): number {
	const priorityDiff = TIMELINE_EVENT_PRIORITY[a.type] - TIMELINE_EVENT_PRIORITY[b.type];
	if (priorityDiff !== 0) return priorityDiff;

	const offeringDiff = a.offeringName.localeCompare(b.offeringName);
	if (offeringDiff !== 0) return offeringDiff;

	const labelDiff = a.categoryLabel.localeCompare(b.categoryLabel);
	if (labelDiff !== 0) return labelDiff;

	return a.leagueId.localeCompare(b.leagueId);
}

function pushTimelineEvent(
	grouped: Map<string, OfferingTimelineGroup>,
	source: OfferingTimelineLeagueSource,
	type: OfferingTimelineEventType,
	date: string | null,
	label: string,
	nowMs: number
): void {
	const parsed = parseTimelineDate(date);
	if (!parsed || !date) return;

	const eventMs = parsed.getTime();
	if (!grouped.has(date)) {
		grouped.set(date, {
			id: createTimelineGroupId(date),
			date,
			ms: eventMs,
			isPast: eventMs < nowMs,
			events: []
		});
	}

	const bucket = grouped.get(date);
	if (!bucket) return;

	bucket.events.push({
		id: `${source.leagueId}-${type}-${date}`,
		type,
		date,
		ms: eventMs,
		label,
		leagueId: source.leagueId,
		leagueName: source.leagueName,
		categoryLabel: source.categoryLabel,
		offeringName: source.offeringName,
		offeringSlug: source.offeringSlug,
		isPast: eventMs < nowMs
	});
}

export function buildOfferingTimelineGroups(
	leagues: OfferingTimelineLeagueSource[],
	now: Date = new Date()
): OfferingTimelineGroup[] {
	const nowMs = now.getTime();
	const grouped = new Map<string, OfferingTimelineGroup>();

	for (const league of leagues) {
		pushTimelineEvent(
			grouped,
			league,
			'registration-deadline',
			league.registrationDeadlineDate,
			league.registrationDeadlineLabel,
			nowMs
		);
		pushTimelineEvent(
			grouped,
			league,
			'join-team-deadline',
			league.joinTeamDate,
			league.joinTeamLabel,
			nowMs
		);
		pushTimelineEvent(
			grouped,
			league,
			'season-start',
			league.seasonStartDate,
			league.seasonStartLabel,
			nowMs
		);
		pushTimelineEvent(
			grouped,
			league,
			'season-end',
			league.seasonEndDate,
			league.seasonEndLabel,
			nowMs
		);
	}

	return Array.from(grouped.values())
		.map((group) => ({
			...group,
			events: group.events.slice().sort(compareTimelineEvents)
		}))
		.sort((a, b) => {
			if (a.ms !== b.ms) return a.ms - b.ms;
			return a.date.localeCompare(b.date);
		});
}

export function findFirstUpcomingTimelineGroup(
	groups: OfferingTimelineGroup[]
): OfferingTimelineGroup | null {
	return groups.find((group) => !group.isPast) ?? null;
}

export function findInitialTimelineGroup(
	groups: OfferingTimelineGroup[]
): OfferingTimelineGroup | null {
	return findFirstUpcomingTimelineGroup(groups) ?? groups[groups.length - 1] ?? null;
}
