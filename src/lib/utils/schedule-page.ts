export type ScheduleStatus =
	| 'scheduled'
	| 'in_progress'
	| 'completed'
	| 'cancelled'
	| 'postponed'
	| 'other';

export type ScheduleView = 'day' | 'week' | 'month';

export interface ScheduleEventRecord {
	id: string;
	type: string;
	status: ScheduleStatus;
	rawStatus: string | null;
	statusLabel: string;
	scheduledStartAt: string | null;
	scheduledEndAt: string | null;
	seasonId: string | null;
	seasonName: string;
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

export interface ScheduleFilters {
	seasonId: string;
	offeringId: string;
	leagueId: string;
	divisionId: string;
	teamId: string;
	status: string;
	searchQuery: string;
}

export interface ScheduleOptionCount {
	value: string;
	label: string;
	count: number;
}

export interface ScheduleOptionCollections {
	seasonOptions: ScheduleOptionCount[];
	offeringOptions: ScheduleOptionCount[];
	leagueOptions: ScheduleOptionCount[];
	divisionOptions: ScheduleOptionCount[];
	teamOptions: ScheduleOptionCount[];
	statusOptions: ScheduleOptionCount[];
}

export interface ScheduleRange {
	startDate: string;
	endDate: string;
}

export interface ScheduleMonthCell {
	dateKey: string;
	date: Date;
	dayNumber: number;
	inCurrentMonth: boolean;
	isToday: boolean;
	events: ScheduleEventRecord[];
}

export interface ScheduleDayBucket {
	dateKey: string;
	label: string;
	events: ScheduleEventRecord[];
}

export interface ScheduleSummary {
	total: number;
	live: number;
	scheduled: number;
	completed: number;
	needsAttention: number;
}

export interface ScheduleDateIndex {
	scheduled: ScheduleEventRecord[];
	unscheduled: ScheduleEventRecord[];
	scheduledByDate: Map<string, ScheduleEventRecord[]>;
}

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function padTwo(value: number): string {
	return String(value).padStart(2, '0');
}

function normalizeText(value: string | null | undefined): string {
	return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function compareScheduleEvents(a: ScheduleEventRecord, b: ScheduleEventRecord): number {
	const aTime = toTimestamp(a.scheduledStartAt);
	const bTime = toTimestamp(b.scheduledStartAt);
	if (aTime !== bTime) return aTime - bTime;

	const scoreDiff = b.scoreSortValue - a.scoreSortValue;
	if (scoreDiff !== 0) return scoreDiff;

	return a.matchup.localeCompare(b.matchup);
}

function sortOptionCounts(options: ScheduleOptionCount[]): ScheduleOptionCount[] {
	return options.sort((a, b) => {
		if (b.count !== a.count) return b.count - a.count;
		return a.label.localeCompare(b.label);
	});
}

function createOptionCounts(
	items: Array<{ value: string | null; label: string | null }>
): ScheduleOptionCount[] {
	const counter = new Map<string, ScheduleOptionCount>();

	for (const item of items) {
		const value = item.value?.trim();
		const label = item.label?.trim();
		if (!value || !label) continue;

		const existing = counter.get(value);
		if (existing) {
			existing.count += 1;
			continue;
		}

		counter.set(value, {
			value,
			label,
			count: 1
		});
	}

	return sortOptionCounts(Array.from(counter.values()));
}

function parseDateKey(value: string): Date | null {
	if (!DATE_KEY_REGEX.test(value)) return null;

	const [yearPart, monthPart, dayPart] = value.split('-');
	const year = Number(yearPart);
	const month = Number(monthPart);
	const day = Number(dayPart);
	const parsed = new Date(year, month - 1, day);

	if (
		Number.isNaN(parsed.getTime()) ||
		parsed.getFullYear() !== year ||
		parsed.getMonth() !== month - 1 ||
		parsed.getDate() !== day
	) {
		return null;
	}

	return parsed;
}

function parseDateTime(value: string | null): Date | null {
	if (!value) return null;

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;

	return parsed;
}

function startOfLocalDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKeyFromDate(date: Date): string {
	return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

function todayDateKey(): string {
	return dateKeyFromDate(new Date());
}

function getNormalizedAnchorDate(anchorDate: string): Date {
	return parseDateKey(anchorDate) ?? parseDateKey(todayDateKey()) ?? new Date();
}

function startOfWeek(date: Date): Date {
	const normalized = startOfLocalDay(date);
	normalized.setDate(normalized.getDate() - normalized.getDay());
	return normalized;
}

function endOfWeek(date: Date): Date {
	const normalized = startOfWeek(date);
	normalized.setDate(normalized.getDate() + 6);
	return normalized;
}

function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function monthGridStart(date: Date): Date {
	return startOfWeek(startOfMonth(date));
}

function monthGridEnd(date: Date): Date {
	const start = monthGridStart(date);
	const end = new Date(start);
	end.setDate(end.getDate() + 41);
	return end;
}

export function getScheduleEventDateKey(value: string | null): string | null {
	const parsed = parseDateTime(value);
	if (!parsed) return null;
	return dateKeyFromDate(parsed);
}

function toTimestamp(value: string | null): number {
	const parsed = parseDateTime(value);
	return parsed ? parsed.getTime() : Number.POSITIVE_INFINITY;
}

function filterByHierarchy(
	events: ScheduleEventRecord[],
	filters: ScheduleFilters
): ScheduleEventRecord[] {
	return events.filter((event) => {
		if (filters.seasonId !== 'all' && event.seasonId !== filters.seasonId) return false;
		if (filters.offeringId !== 'all' && event.offeringId !== filters.offeringId) return false;
		if (filters.leagueId !== 'all' && event.leagueId !== filters.leagueId) return false;
		if (filters.divisionId !== 'all' && event.divisionId !== filters.divisionId) return false;
		if (
			filters.teamId !== 'all' &&
			event.homeTeamId !== filters.teamId &&
			event.awayTeamId !== filters.teamId
		) {
			return false;
		}

		return true;
	});
}

function optionExists(options: ScheduleOptionCount[], value: string): boolean {
	return value === 'all' || options.some((option) => option.value === value);
}

export function buildScheduleOptionCollections(
	events: ScheduleEventRecord[],
	filters?: ScheduleFilters
): ScheduleOptionCollections {
	const normalizedFilters =
		filters ??
		({
			seasonId: 'all',
			offeringId: 'all',
			leagueId: 'all',
			divisionId: 'all',
			teamId: 'all',
			status: 'all',
			searchQuery: ''
		} satisfies ScheduleFilters);
	const seasonScoped = filterByHierarchy(events, {
		...normalizedFilters,
		offeringId: 'all',
		leagueId: 'all',
		divisionId: 'all',
		teamId: 'all'
	});
	const offeringScoped = filterByHierarchy(events, {
		...normalizedFilters,
		leagueId: 'all',
		divisionId: 'all',
		teamId: 'all'
	});
	const leagueScoped = filterByHierarchy(events, {
		...normalizedFilters,
		divisionId: 'all',
		teamId: 'all'
	});
	const divisionScoped = filterByHierarchy(events, {
		...normalizedFilters,
		teamId: 'all'
	});
	const teamScoped = filterByHierarchy(events, normalizedFilters);

	return {
		seasonOptions: createOptionCounts(
			events.map((event) => ({
				value: event.seasonId,
				label: event.seasonName
			}))
		),
		offeringOptions: createOptionCounts(
			seasonScoped.map((event) => ({
				value: event.offeringId,
				label: event.offeringName
			}))
		),
		leagueOptions: createOptionCounts(
			offeringScoped.map((event) => ({
				value: event.leagueId,
				label: event.leagueName
			}))
		),
		divisionOptions: createOptionCounts(
			leagueScoped.map((event) => ({
				value: event.divisionId,
				label: event.divisionName
			}))
		),
		teamOptions: createOptionCounts(
			divisionScoped.flatMap((event) => [
				{
					value: event.homeTeamId,
					label: event.homeTeamName
				},
				{
					value: event.awayTeamId,
					label: event.awayTeamName
				}
			])
		),
		statusOptions: createOptionCounts(
			teamScoped.map((event) => ({
				value: event.status,
				label: event.statusLabel
			}))
		)
	};
}

export function sanitizeScheduleFilters(
	events: ScheduleEventRecord[],
	filters: ScheduleFilters
): ScheduleFilters {
	const sanitizedSeasonId = optionExists(
		buildScheduleOptionCollections(events).seasonOptions,
		filters.seasonId
	)
		? filters.seasonId
		: 'all';
	const seasonNormalized = { ...filters, seasonId: sanitizedSeasonId };
	const offeringOptions = buildScheduleOptionCollections(events, seasonNormalized).offeringOptions;
	const sanitizedOfferingId = optionExists(offeringOptions, filters.offeringId)
		? filters.offeringId
		: 'all';
	const offeringNormalized = { ...seasonNormalized, offeringId: sanitizedOfferingId };
	const leagueOptions = buildScheduleOptionCollections(events, offeringNormalized).leagueOptions;
	const sanitizedLeagueId = optionExists(leagueOptions, filters.leagueId)
		? filters.leagueId
		: 'all';
	const leagueNormalized = { ...offeringNormalized, leagueId: sanitizedLeagueId };
	const divisionOptions = buildScheduleOptionCollections(events, leagueNormalized).divisionOptions;
	const sanitizedDivisionId = optionExists(divisionOptions, filters.divisionId)
		? filters.divisionId
		: 'all';
	const divisionNormalized = { ...leagueNormalized, divisionId: sanitizedDivisionId };
	const teamOptions = buildScheduleOptionCollections(events, divisionNormalized).teamOptions;
	const sanitizedTeamId = optionExists(teamOptions, filters.teamId) ? filters.teamId : 'all';
	const teamNormalized = { ...divisionNormalized, teamId: sanitizedTeamId };
	const statusOptions = buildScheduleOptionCollections(events, teamNormalized).statusOptions;
	const sanitizedStatus = optionExists(statusOptions, filters.status) ? filters.status : 'all';

	return {
		...teamNormalized,
		status: sanitizedStatus,
		searchQuery: filters.searchQuery
	};
}

export function filterScheduleEvents(
	events: ScheduleEventRecord[],
	filters: ScheduleFilters
): ScheduleEventRecord[] {
	const query = normalizeText(filters.searchQuery);

	return filterByHierarchy(events, filters)
		.filter((event) => {
			if (filters.status !== 'all' && event.status !== filters.status) return false;
			if (!query) return true;

			const searchableText = normalizeText(
				[
					event.matchup,
					event.offeringName,
					event.leagueName,
					event.divisionName,
					event.seasonName,
					event.homeTeamName,
					event.awayTeamName,
					event.location,
					event.roundLabel ?? '',
					event.notes ?? ''
				].join(' ')
			);

			return searchableText.includes(query);
		})
		.sort(compareScheduleEvents);
}

export function bucketScheduleEventsByTiming(events: ScheduleEventRecord[]): {
	scheduled: ScheduleEventRecord[];
	unscheduled: ScheduleEventRecord[];
} {
	const index = buildScheduleDateIndex(events);

	return {
		scheduled: index.scheduled,
		unscheduled: index.unscheduled
	};
}

export function buildScheduleDateIndex(events: ScheduleEventRecord[]): ScheduleDateIndex {
	const scheduled: ScheduleEventRecord[] = [];
	const unscheduled: ScheduleEventRecord[] = [];
	const scheduledByDate = new Map<string, ScheduleEventRecord[]>();

	for (const event of events) {
		const dateKey = getScheduleEventDateKey(event.scheduledStartAt);
		if (dateKey) {
			scheduled.push(event);
			const existing = scheduledByDate.get(dateKey);
			if (existing) {
				existing.push(event);
			} else {
				scheduledByDate.set(dateKey, [event]);
			}
			continue;
		}

		unscheduled.push(event);
	}

	return {
		scheduled: [...scheduled].sort(compareScheduleEvents),
		unscheduled: [...unscheduled].sort((a, b) => a.matchup.localeCompare(b.matchup)),
		scheduledByDate: new Map(
			Array.from(scheduledByDate.entries()).map(([dateKey, dateEvents]) => [
				dateKey,
				[...dateEvents].sort(compareScheduleEvents)
			])
		)
	};
}

export function getScheduleRangeForView(anchorDate: string, view: ScheduleView): ScheduleRange {
	const normalized = getNormalizedAnchorDate(anchorDate);

	if (view === 'day') {
		const key = dateKeyFromDate(normalized);
		return { startDate: key, endDate: key };
	}

	if (view === 'week') {
		return {
			startDate: dateKeyFromDate(startOfWeek(normalized)),
			endDate: dateKeyFromDate(endOfWeek(normalized))
		};
	}

	return {
		startDate: dateKeyFromDate(startOfMonth(normalized)),
		endDate: dateKeyFromDate(endOfMonth(normalized))
	};
}

export function shiftScheduleAnchorDate(
	anchorDate: string,
	view: ScheduleView,
	direction: -1 | 1
): string {
	const normalized = getNormalizedAnchorDate(anchorDate);
	const next = new Date(normalized);

	if (view === 'day') {
		next.setDate(next.getDate() + direction);
		return dateKeyFromDate(next);
	}

	if (view === 'week') {
		next.setDate(next.getDate() + direction * 7);
		return dateKeyFromDate(next);
	}

	next.setMonth(next.getMonth() + direction);
	return dateKeyFromDate(next);
}

export function buildWeekScheduleDays(
	events: ScheduleEventRecord[],
	anchorDate: string
): ScheduleDayBucket[] {
	const start = startOfWeek(getNormalizedAnchorDate(anchorDate));
	const dateIndex = buildScheduleDateIndex(events);

	return Array.from({ length: 7 }, (_, index) => {
		const current = new Date(start);
		current.setDate(start.getDate() + index);
		const key = dateKeyFromDate(current);

		return {
			dateKey: key,
			label: current.toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric'
			}),
			events: dateIndex.scheduledByDate.get(key) ?? []
		};
	});
}

export function buildMonthScheduleCells(
	events: ScheduleEventRecord[],
	anchorDate: string
): ScheduleMonthCell[] {
	const normalized = getNormalizedAnchorDate(anchorDate);
	const firstCell = monthGridStart(normalized);
	const lastCell = monthGridEnd(normalized);
	const dateIndex = buildScheduleDateIndex(events);
	const todayKey = todayDateKey();
	const cells: ScheduleMonthCell[] = [];

	for (
		let current = new Date(firstCell);
		current <= lastCell;
		current.setDate(current.getDate() + 1)
	) {
		const cellDate = new Date(current);
		const key = dateKeyFromDate(cellDate);
		cells.push({
			dateKey: key,
			date: cellDate,
			dayNumber: cellDate.getDate(),
			inCurrentMonth: cellDate.getMonth() === normalized.getMonth(),
			isToday: key === todayKey,
			events: dateIndex.scheduledByDate.get(key) ?? []
		});
	}

	return cells;
}

export function getEventsForDate(
	events: ScheduleEventRecord[],
	dateKey: string
): ScheduleEventRecord[] {
	return buildScheduleDateIndex(events).scheduledByDate.get(dateKey) ?? [];
}

export function summarizeScheduleEvents(events: ScheduleEventRecord[]): ScheduleSummary {
	return {
		total: events.length,
		live: events.filter((event) => event.status === 'in_progress').length,
		scheduled: events.filter((event) => event.status === 'scheduled').length,
		completed: events.filter((event) => event.status === 'completed').length,
		needsAttention: events.filter(
			(event) => event.status === 'cancelled' || event.status === 'postponed'
		).length
	};
}
