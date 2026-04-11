export type DatePickerType = 'date' | 'datetime-local';
export type DatePickerShortcut = 'yesterday' | 'today' | 'tomorrow';

export interface DatePickerParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}

export interface MonthReference {
	year: number;
	month: number;
}

export interface CalendarCell {
	dateKey: string;
	dayNumber: number;
	monthOffset: -1 | 0 | 1;
	isCurrentMonth: boolean;
	isDisabled: boolean;
	isSelected: boolean;
	isToday: boolean;
	isInRange: boolean;
	isRangeStart: boolean;
	isRangeEnd: boolean;
}

export interface PickerYearRange {
	minYear: number;
	maxYear: number;
}

export interface CalendarWheelDeltaResult {
	remainderDeltaY: number;
	monthDelta: number;
}

export interface DisplaySelectionRange {
	start: number;
	end: number;
}

interface CalendarGridOptions {
	value?: string;
	type: DatePickerType;
	min?: string;
	max?: string;
	today?: string;
	rangeStart?: string;
	rangeEnd?: string;
}

const DATE_VALUE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_LOCAL_VALUE_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const DISPLAY_TIME_REGEX = /^(\d{2}):(\d{2})$/;
const DEFAULT_DATE_DISPLAY_FORMAT = 'MM/DD/YYYY';
const DEFAULT_CALENDAR_WHEEL_THRESHOLD = 72;
const DEFAULT_CALENDAR_WHEEL_GESTURE_GAP_MS = 80;
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
	month: 'long',
	timeZone: 'UTC'
});

function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidDateParts(year: number, month: number, day: number): boolean {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
	if (month < 1 || month > 12) return false;
	if (day < 1 || day > daysInMonth(year, month)) return false;
	return true;
}

function isValidTimeParts(hour: number, minute: number): boolean {
	if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
	if (hour < 0 || hour > 23) return false;
	if (minute < 0 || minute > 59) return false;
	return true;
}

function compareMonthReferences(left: MonthReference, right: MonthReference): number {
	if (left.year !== right.year) return left.year - right.year;
	return left.month - right.month;
}

function clampMonthReference(
	reference: MonthReference,
	minReference?: MonthReference | null,
	maxReference?: MonthReference | null
): MonthReference {
	if (minReference && compareMonthReferences(reference, minReference) < 0) {
		return { ...minReference };
	}

	if (maxReference && compareMonthReferences(reference, maxReference) > 0) {
		return { ...maxReference };
	}

	return reference;
}

function monthReferenceFromValue(value: string | undefined, type: DatePickerType): MonthReference | null {
	const parsed = parsePickerValue(value ?? '', type);
	if (!parsed) return null;
	return { year: parsed.year, month: parsed.month };
}

function dateKeyFromParts(parts: Pick<DatePickerParts, 'year' | 'month' | 'day'>): string {
	return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function dateKeyFromDate(date: Date): string {
	return dateKeyFromParts({
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		day: date.getDate()
	});
}

function dateKeyFromValue(value: string | undefined, type: DatePickerType): string | null {
	const parsed = parsePickerValue(value ?? '', type);
	if (!parsed) return null;
	return dateKeyFromParts(parsed);
}

export function formatMonthReferenceLabel(reference: MonthReference): string {
	return MONTH_LABEL_FORMATTER.format(new Date(Date.UTC(reference.year, reference.month - 1, 1, 12)));
}

function addDays(dateKey: string, dayDelta: number): string {
	const parsed = parsePickerValue(dateKey, 'date');
	if (!parsed) return dateKey;
	const utcDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + dayDelta));
	return `${utcDate.getUTCFullYear()}-${pad2(utcDate.getUTCMonth() + 1)}-${pad2(utcDate.getUTCDate())}`;
}

function weekdayIndex(dateKey: string): number {
	const parsed = parsePickerValue(dateKey, 'date');
	if (!parsed) return 0;
	return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
}

function compareIsoValues(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

function currentLocalParts(now: Date): Pick<DatePickerParts, 'year' | 'month' | 'day' | 'hour' | 'minute'> {
	return {
		year: now.getFullYear(),
		month: now.getMonth() + 1,
		day: now.getDate(),
		hour: now.getHours(),
		minute: now.getMinutes()
	};
}

function normalizeYearValue(value: number | undefined): number | null {
	if (!Number.isFinite(value)) return null;
	return Math.trunc(value as number);
}

function extractYearCandidate(value: string | number | null | undefined): number | null {
	if (typeof value === 'number') {
		return normalizeYearValue(value);
	}

	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;

	const dateMatch = /^(\d{4})-/.exec(trimmed);
	if (dateMatch) return Number(dateMatch[1]);

	const displayMatch = /(\d{4})/.exec(trimmed);
	return displayMatch ? Number(displayMatch[1]) : null;
}

type DateDisplayToken = 'MM' | 'DD' | 'YYYY';

interface DateFormatSegment {
	kind: 'token' | 'literal';
	value: string;
}

function splitDateFormat(format: string): DateFormatSegment[] | null {
	const normalized = format.trim();
	if (!normalized) return null;

	const segments: DateFormatSegment[] = [];
	let cursor = 0;
	while (cursor < normalized.length) {
		const remainder = normalized.slice(cursor);
		if (remainder.startsWith('YYYY')) {
			segments.push({ kind: 'token', value: 'YYYY' });
			cursor += 4;
			continue;
		}

		if (remainder.startsWith('MM') || remainder.startsWith('DD')) {
			segments.push({ kind: 'token', value: remainder.slice(0, 2) });
			cursor += 2;
			continue;
		}

		segments.push({ kind: 'literal', value: normalized[cursor] });
		cursor += 1;
	}

	const tokenSequence = segments.filter((segment) => segment.kind === 'token').map((segment) => segment.value);
	const hasEachDateToken =
		tokenSequence.filter((token) => token === 'MM').length === 1 &&
		tokenSequence.filter((token) => token === 'DD').length === 1 &&
		tokenSequence.filter((token) => token === 'YYYY').length === 1;

	return hasEachDateToken ? segments : null;
}

function resolveDateDisplayFormat(format?: string): string {
	return splitDateFormat(format ?? '') ? format!.trim() : DEFAULT_DATE_DISPLAY_FORMAT;
}

function displayLayout(type: DatePickerType, format?: string): string {
	const dateLayout = resolveDateDisplayFormat(format);
	return type === 'date' ? dateLayout : `${dateLayout} HH:mm`;
}

function displaySelectionSegments(type: DatePickerType, format?: string): DisplaySelectionRange[] {
	const layout = displayLayout(type, format);
	const tokenMatches = Array.from(layout.matchAll(/YYYY|MM|DD|HH|mm/g));
	return tokenMatches.map((match) => ({
		start: match.index ?? 0,
		end: (match.index ?? 0) + match[0].length
	}));
}

function selectionSegmentIndexForCaret(
	segments: DisplaySelectionRange[],
	caret: number
): number {
	if (segments.length === 0) return -1;

	const containingIndex = segments.findIndex((segment) => caret >= segment.start && caret < segment.end);
	if (containingIndex !== -1) return containingIndex;

	const nextIndex = segments.findIndex((segment) => caret < segment.start);
	return nextIndex !== -1 ? nextIndex : segments.length - 1;
}

function formatDatePartsForDisplay(
	parts: Pick<DatePickerParts, 'year' | 'month' | 'day'>,
	format?: string
): string {
	const resolvedFormat = resolveDateDisplayFormat(format);
	const segments = splitDateFormat(resolvedFormat) ?? [];
	return segments
		.map((segment) => {
			if (segment.kind === 'literal') return segment.value;
			if (segment.value === 'MM') return pad2(parts.month);
			if (segment.value === 'DD') return pad2(parts.day);
			return String(parts.year);
		})
		.join('');
}

function parseDateDisplayParts(
	value: string,
	format?: string
): Pick<DatePickerParts, 'year' | 'month' | 'day'> | null {
	const resolvedFormat = resolveDateDisplayFormat(format);
	const segments = splitDateFormat(resolvedFormat);
	if (!segments) return null;

	let cursor = 0;
	let year: number | null = null;
	let month: number | null = null;
	let day: number | null = null;

	for (const segment of segments) {
		if (segment.kind === 'literal') {
			if (value.slice(cursor, cursor + segment.value.length) !== segment.value) return null;
			cursor += segment.value.length;
			continue;
		}

		const width = segment.value === 'YYYY' ? 4 : 2;
		const slice = value.slice(cursor, cursor + width);
		if (!/^\d+$/.test(slice) || slice.length !== width) return null;

		if (segment.value === 'YYYY') year = Number(slice);
		if (segment.value === 'MM') month = Number(slice);
		if (segment.value === 'DD') day = Number(slice);
		cursor += width;
	}

	if (cursor !== value.length || year === null || month === null || day === null) return null;
	if (!isValidDateParts(year, month, day)) return null;
	return { year, month, day };
}

export function parsePickerValue(
	value: string,
	type: DatePickerType
): DatePickerParts | null {
	const trimmed = value.trim();
	const match =
		type === 'datetime-local'
			? DATETIME_LOCAL_VALUE_REGEX.exec(trimmed)
			: DATE_VALUE_REGEX.exec(trimmed);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = type === 'datetime-local' ? Number(match[4]) : 0;
	const minute = type === 'datetime-local' ? Number(match[5]) : 0;

	if (!isValidDateParts(year, month, day)) return null;
	if (!isValidTimeParts(hour, minute)) return null;

	return { year, month, day, hour, minute };
}

export function parseDisplayPickerValue(
	value: string,
	type: DatePickerType,
	format?: string
): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const isoParsed = parsePickerValue(trimmed, type);
	if (isoParsed) {
		return serializePickerValue(isoParsed, type);
	}

	if (type === 'date') {
		const dateParts = parseDateDisplayParts(trimmed, format);
		if (!dateParts) return null;
		return dateKeyFromParts(dateParts);
	}

	const timeMatch = /^(.*?)(?:\s+|T)(\d{2}:\d{2})$/.exec(trimmed);
	if (!timeMatch) return null;
	const dateParts = parseDateDisplayParts(timeMatch[1].trim(), format);
	if (!dateParts) return null;
	const parsedTime = DISPLAY_TIME_REGEX.exec(timeMatch[2]);
	if (!parsedTime) return null;

	const hour = Number(parsedTime[1]);
	const minute = Number(parsedTime[2]);
	if (!isValidTimeParts(hour, minute)) return null;

	return `${dateKeyFromParts(dateParts)}T${pad2(hour)}:${pad2(minute)}`;
}

export function resolvePickerYearRange(
	minYear?: number,
	maxYear?: number,
	now = new Date()
): PickerYearRange {
	const currentYear = now.getFullYear();
	const resolvedMinYear = normalizeYearValue(minYear) ?? currentYear;
	const resolvedMaxYear = normalizeYearValue(maxYear) ?? currentYear + 10;

	return resolvedMinYear <= resolvedMaxYear
		? { minYear: resolvedMinYear, maxYear: resolvedMaxYear }
		: { minYear: resolvedMaxYear, maxYear: resolvedMinYear };
}

export function inferPickerYearRange(
	values: Array<string | number | null | undefined>,
	options: {
		minYear?: number;
		maxYear?: number;
		pastYears?: number;
		futureYears?: number;
		now?: Date;
	} = {}
): PickerYearRange {
	const now = options.now ?? new Date();
	const currentYear = now.getFullYear();
	const baseline = resolvePickerYearRange(
		options.minYear ?? currentYear - (options.pastYears ?? 0),
		options.maxYear ?? currentYear + (options.futureYears ?? 10),
		now
	);

	const inferredYears = values
		.map((value) => extractYearCandidate(value))
		.filter((value): value is number => value !== null);
	if (inferredYears.length === 0) {
		return baseline;
	}

	return {
		minYear: Math.min(baseline.minYear, ...inferredYears),
		maxYear: Math.max(baseline.maxYear, ...inferredYears)
	};
}

export function consumeCalendarWheelDelta(
	remainderDeltaY: number,
	deltaY: number,
	threshold = DEFAULT_CALENDAR_WHEEL_THRESHOLD
): CalendarWheelDeltaResult {
	if (!Number.isFinite(deltaY) || !Number.isFinite(remainderDeltaY)) {
		return { remainderDeltaY: 0, monthDelta: 0 };
	}

	const resolvedThreshold = Number.isFinite(threshold) && threshold > 0 ? threshold : DEFAULT_CALENDAR_WHEEL_THRESHOLD;
	const nextDelta = remainderDeltaY + deltaY;
	if (Math.abs(nextDelta) < resolvedThreshold) {
		return {
			remainderDeltaY: nextDelta,
			monthDelta: 0
		};
	}

	return {
		remainderDeltaY: 0,
		monthDelta: nextDelta < 0 ? -1 : 1
	};
}

export function shouldResetCalendarWheelGesture(
	lastEventTimestamp: number | null,
	nextEventTimestamp: number,
	lockedDirection: -1 | 0 | 1,
	deltaY: number,
	gapMs = DEFAULT_CALENDAR_WHEEL_GESTURE_GAP_MS
): boolean {
	if (!Number.isFinite(nextEventTimestamp)) return false;
	if (lastEventTimestamp === null || !Number.isFinite(lastEventTimestamp)) return true;

	const resolvedGapMs =
		Number.isFinite(gapMs) && gapMs >= 0 ? gapMs : DEFAULT_CALENDAR_WHEEL_GESTURE_GAP_MS;
	const deltaDirection: -1 | 0 | 1 = deltaY < 0 ? -1 : deltaY > 0 ? 1 : 0;
	if (deltaDirection !== 0 && lockedDirection !== 0 && deltaDirection !== lockedDirection) {
		return true;
	}

	return nextEventTimestamp - lastEventTimestamp > resolvedGapMs;
}

export function resolveDisplaySelectionRange(
	value: string,
	type: DatePickerType,
	format?: string,
	caret = 0
): DisplaySelectionRange {
	const segments = displaySelectionSegments(type, format);
	if (segments.length === 0) {
		return {
			start: 0,
			end: value.length
		};
	}

	const clampedCaret = Math.max(0, Math.min(caret, Math.max(value.length, segments.at(-1)?.end ?? 0)));
	return segments[selectionSegmentIndexForCaret(segments, clampedCaret)] ?? segments[0];
}

export function moveDisplaySelectionRange(
	value: string,
	type: DatePickerType,
	format: string | undefined,
	currentStart: number,
	currentEnd: number,
	direction: -1 | 1
): DisplaySelectionRange {
	const segments = displaySelectionSegments(type, format);
	if (segments.length === 0) {
		return {
			start: 0,
			end: value.length
		};
	}

	const currentIndex = segments.findIndex(
		(segment) => segment.start === currentStart && segment.end === currentEnd
	);
	const fallbackIndex = selectionSegmentIndexForCaret(segments, direction < 0 ? currentStart : currentEnd);
	const resolvedIndex = currentIndex === -1 ? fallbackIndex : currentIndex;
	const nextIndex = Math.max(0, Math.min(resolvedIndex + direction, segments.length - 1));
	return segments[nextIndex] ?? segments[0];
}

export function serializePickerValue(parts: DatePickerParts, type: DatePickerType): string {
	const dateValue = dateKeyFromParts(parts);
	if (type === 'date') return dateValue;
	return `${dateValue}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function formatPickerValueForDisplay(
	value: string,
	type: DatePickerType,
	format?: string
): string {
	const parsed = parsePickerValue(value, type);
	if (!parsed) return value;

	const formattedDate = formatDatePartsForDisplay(parsed, format);
	if (type === 'date') return formattedDate;
	return `${formattedDate} ${pad2(parsed.hour)}:${pad2(parsed.minute)}`;
}

export function clampPickerValue(
	value: string,
	type: DatePickerType,
	min?: string,
	max?: string
): string {
	const parsed = parsePickerValue(value, type);
	if (!parsed) return value;

	const normalizedValue = serializePickerValue(parsed, type);
	const normalizedMin = min ? serializePickerValue(parsePickerValue(min, type) ?? parsed, type) : null;
	const normalizedMax = max ? serializePickerValue(parsePickerValue(max, type) ?? parsed, type) : null;

	if (normalizedMin && compareIsoValues(normalizedValue, normalizedMin) < 0) return normalizedMin;
	if (normalizedMax && compareIsoValues(normalizedValue, normalizedMax) > 0) return normalizedMax;
	return normalizedValue;
}

export function shiftMonthReference(
	reference: MonthReference,
	delta: number,
	type: DatePickerType,
	min?: string,
	max?: string
): MonthReference {
	const shiftedMonthIndex = reference.month - 1 + delta;
	const shiftedYear = reference.year + Math.floor(shiftedMonthIndex / 12);
	const shiftedMonth = ((shiftedMonthIndex % 12) + 12) % 12 + 1;
	const shifted = { year: shiftedYear, month: shiftedMonth };

	return clampMonthReference(
		shifted,
		monthReferenceFromValue(min, type),
		monthReferenceFromValue(max, type)
	);
}

export function shiftDateKeyByMonths(dateKey: string, delta: number): string {
	const parsed = parsePickerValue(dateKey, 'date');
	if (!parsed || !Number.isFinite(delta) || delta === 0) return dateKey;

	const shiftedMonthIndex = parsed.month - 1 + delta;
	const shiftedYear = parsed.year + Math.floor(shiftedMonthIndex / 12);
	const shiftedMonth = ((shiftedMonthIndex % 12) + 12) % 12 + 1;
	const shiftedDay = Math.min(parsed.day, daysInMonth(shiftedYear, shiftedMonth));

	return dateKeyFromParts({
		year: shiftedYear,
		month: shiftedMonth,
		day: shiftedDay
	});
}

export function resolveCalendarKeyboardDateKey(
	dateKey: string,
	key: string,
	shiftKey: boolean
): string | null {
	if (key === 'ArrowLeft') return addDays(dateKey, -1);
	if (key === 'ArrowRight') return addDays(dateKey, 1);
	if (key === 'ArrowUp') return shiftKey ? shiftDateKeyByMonths(dateKey, -1) : addDays(dateKey, -7);
	if (key === 'ArrowDown') {
		return shiftKey ? shiftDateKeyByMonths(dateKey, 1) : addDays(dateKey, 7);
	}

	return null;
}

export function buildCalendarGrid(
	reference: MonthReference,
	options: CalendarGridOptions
): CalendarCell[] {
	const firstOfMonth = `${reference.year}-${pad2(reference.month)}-01`;
	const firstWeekday = weekdayIndex(firstOfMonth);
	const startDateKey = addDays(firstOfMonth, -firstWeekday);
	const selectedDateKey = dateKeyFromValue(options.value, options.type);
	const todayDateKey = options.today ?? dateKeyFromDate(new Date());
	const minDateKey = dateKeyFromValue(options.min, options.type);
	const maxDateKey = dateKeyFromValue(options.max, options.type);
	const normalizedRangeStart = dateKeyFromValue(options.rangeStart, 'date');
	const normalizedRangeEnd = dateKeyFromValue(options.rangeEnd, 'date');
	const hasRange = Boolean(normalizedRangeStart && normalizedRangeEnd);
	const rangeStartDateKey = !hasRange
		? null
		: normalizedRangeStart! <= normalizedRangeEnd!
			? normalizedRangeStart!
			: normalizedRangeEnd!;
	const rangeEndDateKey = !hasRange
		? null
		: normalizedRangeStart! <= normalizedRangeEnd!
			? normalizedRangeEnd!
			: normalizedRangeStart!;

	return Array.from({ length: 42 }, (_, index) => {
		const dateKey = addDays(startDateKey, index);
		const parsed = parsePickerValue(dateKey, 'date');
		const monthOffset = parsed
			? parsed.year === reference.year && parsed.month === reference.month
				? 0
				: parsed.year < reference.year || (parsed.year === reference.year && parsed.month < reference.month)
					? -1
					: 1
			: 0;
		const isDisabled =
			(minDateKey !== null && minDateKey !== undefined && compareIsoValues(dateKey, minDateKey) < 0) ||
			(maxDateKey !== null && maxDateKey !== undefined && compareIsoValues(dateKey, maxDateKey) > 0);

		return {
			dateKey,
			dayNumber: parsed?.day ?? 0,
			monthOffset,
			isCurrentMonth: monthOffset === 0,
			isDisabled,
			isSelected: selectedDateKey === dateKey,
			isToday: todayDateKey === dateKey,
			isInRange:
				rangeStartDateKey !== null &&
				rangeEndDateKey !== null &&
				dateKey >= rangeStartDateKey &&
				dateKey <= rangeEndDateKey,
			isRangeStart: rangeStartDateKey === dateKey,
			isRangeEnd: rangeEndDateKey === dateKey
		};
	});
}

export function buildCalendarMonthWindow(
	reference: MonthReference,
	type: DatePickerType,
	min?: string,
	max?: string
): [MonthReference, MonthReference, MonthReference] {
	return [
		shiftMonthReference(reference, -1, type, min, max),
		{ ...reference },
		shiftMonthReference(reference, 1, type, min, max)
	];
}

export function resolveCalendarMonthStripPageOffset(direction: -1 | 0 | 1): number {
	if (direction === -1) return 0;
	if (direction === 1) return 2;
	return 1;
}

export function mergeDateKeyWithValue(
	dateKey: string,
	currentValue: string,
	type: DatePickerType,
	now = new Date()
): string {
	if (type === 'date') return dateKey;

	const currentParts = parsePickerValue(currentValue, 'datetime-local');
	const fallback = currentLocalParts(now);
	return `${dateKey}T${pad2(currentParts?.hour ?? fallback.hour)}:${pad2(
		currentParts?.minute ?? fallback.minute
	)}`;
}

export function buildShortcutValue(
	currentValue: string,
	type: DatePickerType,
	shortcut: DatePickerShortcut,
	now = new Date()
): string {
	const todayKey = dateKeyFromDate(now);
	if (shortcut === 'today') {
		return mergeDateKeyWithValue(todayKey, currentValue, type, now);
	}

	const nextDateKey = addDays(todayKey, shortcut === 'yesterday' ? -1 : 1);
	return mergeDateKeyWithValue(nextDateKey, currentValue, type, now);
}
