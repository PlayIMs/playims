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

export interface ScheduleNavigatorDay {
	dateKey: string;
	dayNumber: string;
	monthLabel: string;
	weekdayLabel: string;
	isToday: boolean;
}

export interface ScheduleNavigatorWeek {
	anchorDate: string;
	startDate: string;
	endDate: string;
	rangeLabel: string;
	monthLabel: string;
	isCurrentWeek: boolean;
}

export interface ScheduleNavigatorMonth {
	anchorDate: string;
	startDate: string;
	endDate: string;
	rangeLabel: string;
	monthLabel: string;
	isCurrentMonth: boolean;
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

export interface ScheduleUrlSyncState {
	searchQuery: string;
	selectedSeasonId: string;
	defaultSeasonId: string;
	selectedOfferingId: string;
	selectedLeagueId: string;
	selectedDivisionId: string;
	selectedView: string;
	defaultView: string;
	anchorDate: string;
	selectedMonthDate: string;
	selectedRangeStartDate: string;
	selectedRangeEndDate: string;
	today: string;
}

export interface ScheduleKeyboardNavigationContext {
	key: string;
	hasOpenDatePicker: boolean;
	hasOpenDropdown: boolean;
	isEditableTarget: boolean;
}

export interface ScheduleKeyboardShortcutMove {
	unit: 'day' | 'week';
	direction: -1 | 1;
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

function setUrlSearchParam(url: URL, key: string, value: string | null): void {
	if (value && value.trim().length > 0) {
		url.searchParams.set(key, value);
		return;
	}

	url.searchParams.delete(key);
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

function shiftMonthPreservingDay(date: Date, monthDelta: number): Date {
	const targetMonth = new Date(date.getFullYear(), date.getMonth() + monthDelta, 1);
	const targetLastDay = endOfMonth(targetMonth).getDate();
	return new Date(
		targetMonth.getFullYear(),
		targetMonth.getMonth(),
		Math.min(date.getDate(), targetLastDay)
	);
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

export function normalizeScheduleDateRange(
	startDate: string,
	endDate: string,
	fallbackDate = todayDateKey()
): ScheduleRange {
	const normalizedFallback = dateKeyFromDate(getNormalizedAnchorDate(fallbackDate));
	const normalizedStart = parseDateKey(startDate) ? startDate : normalizedFallback;
	const normalizedEnd = parseDateKey(endDate) ? endDate : normalizedStart;

	if (normalizedStart <= normalizedEnd) {
		return {
			startDate: normalizedStart,
			endDate: normalizedEnd
		};
	}

	return {
		startDate: normalizedEnd,
		endDate: normalizedStart
	};
}

export function countScheduleRangeDays(range: ScheduleRange): number {
	const normalizedRange = normalizeScheduleDateRange(range.startDate, range.endDate);
	const start = parseDateKey(normalizedRange.startDate);
	const end = parseDateKey(normalizedRange.endDate);
	if (!start || !end) return 0;

	const millisecondsPerDay = 24 * 60 * 60 * 1000;
	return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
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

	return dateKeyFromDate(shiftMonthPreservingDay(normalized, direction));
}

export function resolveScheduleNavigatorDirection(
	key: string,
	shiftKey = false
): -7 | -1 | 1 | 7 | null {
	if (key === 'ArrowLeft') return shiftKey ? -7 : -1;
	if (key === 'ArrowRight') return shiftKey ? 7 : 1;
	return null;
}

export function shouldHandleScheduleKeyboardNavigation(
	context: ScheduleKeyboardNavigationContext
): boolean {
	if (resolveScheduleNavigatorDirection(context.key) === null) return false;
	if (context.hasOpenDatePicker) return false;
	if (context.hasOpenDropdown) return false;
	if (context.isEditableTarget) return false;
	return true;
}

export function resolveScheduleKeyboardShortcutMove(
	key: string,
	shiftKey = false
): ScheduleKeyboardShortcutMove | null {
	const direction = resolveScheduleNavigatorDirection(key, shiftKey);
	if (direction === null) return null;

	return {
		unit: Math.abs(direction) === 7 ? 'week' : 'day',
		direction: direction < 0 ? -1 : 1
	};
}

export function resolveScheduleNavigatorFocusDateKey(
	view: string,
	anchorDate: string
): string | null {
	return view === 'date-range' ? null : anchorDate;
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

export function buildCenteredScheduleDays(anchorDate: string, radius = 3): ScheduleNavigatorDay[] {
	const center = getNormalizedAnchorDate(anchorDate);
	const totalDays = Math.max(1, radius * 2 + 1);
	const todayKey = todayDateKey();

	return Array.from({ length: totalDays }, (_, index) => {
		const current = new Date(center);
		current.setDate(center.getDate() + index - radius);
		const key = dateKeyFromDate(current);

		return {
			dateKey: key,
			dayNumber: String(current.getDate()),
			monthLabel: current.toLocaleDateString('en-US', {
				month: 'short'
			}),
			weekdayLabel: current.toLocaleDateString('en-US', {
				weekday: 'short'
			}),
			isToday: key === todayKey
		};
	});
}

export function buildCenteredScheduleWeeks(
	anchorDate: string,
	previousWeeks = 3,
	nextWeeks = 2
): ScheduleNavigatorWeek[] {
	const center = getNormalizedAnchorDate(anchorDate);
	const todayRange = getScheduleRangeForView(todayDateKey(), 'week');

	return Array.from({ length: Math.max(1, previousWeeks + nextWeeks + 1) }, (_, index) => {
		const weekOffset = index - previousWeeks;
		const current = new Date(center);
		current.setDate(center.getDate() + weekOffset * 7);
		const range = getScheduleRangeForView(dateKeyFromDate(current), 'week');
		const start = parseDateKey(range.startDate) ?? current;

		return {
			anchorDate: dateKeyFromDate(current),
			startDate: range.startDate,
			endDate: range.endDate,
			rangeLabel: `${start.getDate()}-${endOfWeek(start).getDate()}`,
			monthLabel: start.toLocaleDateString('en-US', {
				month: 'short'
			}),
			isCurrentWeek:
				range.startDate === todayRange.startDate && range.endDate === todayRange.endDate
		};
	});
}

export function buildCenteredScheduleMonths(
	anchorDate: string,
	previousMonths = 3,
	nextMonths = 3
): ScheduleNavigatorMonth[] {
	const center = getNormalizedAnchorDate(anchorDate);
	const todayRange = getScheduleRangeForView(todayDateKey(), 'month');

	return Array.from({ length: Math.max(1, previousMonths + nextMonths + 1) }, (_, index) => {
		const monthOffset = index - previousMonths;
		const current = shiftMonthPreservingDay(center, monthOffset);
		const range = getScheduleRangeForView(dateKeyFromDate(current), 'month');
		const start = parseDateKey(range.startDate) ?? current;
		const end = parseDateKey(range.endDate) ?? endOfMonth(start);

		return {
			anchorDate: dateKeyFromDate(current),
			startDate: range.startDate,
			endDate: range.endDate,
			rangeLabel: `${start.getDate()}-${end.getDate()}`,
			monthLabel: start.toLocaleDateString('en-US', {
				month: 'short'
			}),
			isCurrentMonth:
				range.startDate === todayRange.startDate && range.endDate === todayRange.endDate
		};
	});
}

export function buildScheduleAgendaBuckets(
	events: ScheduleEventRecord[],
	range?: Partial<ScheduleRange>
): ScheduleDayBucket[] {
	const dateIndex = buildScheduleDateIndex(events);
	const entries = Array.from(dateIndex.scheduledByDate.entries())
		.filter(([dateKey]) => {
			if (range?.startDate && dateKey < range.startDate) return false;
			if (range?.endDate && dateKey > range.endDate) return false;
			return true;
		})
		.sort(([a], [b]) => a.localeCompare(b));

	return entries.map(([dateKey, dayEvents]) => {
		const parsed = parseDateKey(dateKey);
		const label = parsed
			? parsed.toLocaleDateString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				})
			: dateKey;

		return {
			dateKey,
			label,
			events: dayEvents
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

export function buildNextScheduleHref(
	currentHref: string,
	state: ScheduleUrlSyncState
): string | null {
	const nextUrl = new URL(currentHref);
	const normalizedDateRange = normalizeScheduleDateRange(
		state.selectedRangeStartDate,
		state.selectedRangeEndDate,
		state.anchorDate
	);

	setUrlSearchParam(nextUrl, 'q', state.searchQuery.trim() || null);
	setUrlSearchParam(
		nextUrl,
		'season',
		state.selectedSeasonId !== state.defaultSeasonId ? state.selectedSeasonId : null
	);
	setUrlSearchParam(
		nextUrl,
		'offering',
		state.selectedOfferingId !== 'all' ? state.selectedOfferingId : null
	);
	setUrlSearchParam(
		nextUrl,
		'league',
		state.selectedLeagueId !== 'all' ? state.selectedLeagueId : null
	);
	setUrlSearchParam(
		nextUrl,
		'division',
		state.selectedDivisionId !== 'all' ? state.selectedDivisionId : null
	);
	setUrlSearchParam(nextUrl, 'team', null);
	setUrlSearchParam(nextUrl, 'status', null);
	setUrlSearchParam(nextUrl, 'view', state.selectedView);
	setUrlSearchParam(nextUrl, 'date', state.anchorDate !== state.today ? state.anchorDate : null);
	setUrlSearchParam(
		nextUrl,
		'selectedDay',
		state.selectedView === 'month' && state.selectedMonthDate !== state.anchorDate
			? state.selectedMonthDate
			: null
	);
	setUrlSearchParam(
		nextUrl,
		'startDate',
		state.selectedView === 'date-range' ? normalizedDateRange.startDate : null
	);
	setUrlSearchParam(
		nextUrl,
		'endDate',
		state.selectedView === 'date-range' ? normalizedDateRange.endDate : null
	);

	const currentUrl = new URL(currentHref);
	const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
	const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
	return currentPath === nextPath ? null : nextPath;
}
