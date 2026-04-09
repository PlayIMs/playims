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
}

interface CalendarGridOptions {
	value?: string;
	type: DatePickerType;
	min?: string;
	max?: string;
	today?: string;
}

const DATE_VALUE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_LOCAL_VALUE_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

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

export function serializePickerValue(parts: DatePickerParts, type: DatePickerType): string {
	const dateValue = dateKeyFromParts(parts);
	if (type === 'date') return dateValue;
	return `${dateValue}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
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
			isToday: todayDateKey === dateKey
		};
	});
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
