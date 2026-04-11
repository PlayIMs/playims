import {
	parsePickerValue,
	shiftMonthReference,
	type MonthReference
} from '$lib/components/date-picker.js';

export type DateRangeBoundary = 'start' | 'end';

export interface DateRangeValue {
	startDate: string;
	endDate: string;
}

export interface DateRangeCalendarMonths {
	startMonth: MonthReference;
	endMonth: MonthReference;
}

export interface DateRangeSelectionState extends DateRangeValue {
	activeBoundary: DateRangeBoundary;
}

function compareDateKeys(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

function todayDateKey(): string {
	const today = new Date();
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
		today.getDate()
	).padStart(2, '0')}`;
}

export function isDateKey(value: string | null | undefined): value is string {
	return parsePickerValue(value ?? '', 'date') !== null;
}

export function normalizeDateRangeValue(
	startDate: string,
	endDate: string,
	fallbackDate = todayDateKey()
): DateRangeValue {
	const normalizedFallback = isDateKey(fallbackDate) ? fallbackDate : todayDateKey();
	const normalizedStart = isDateKey(startDate) ? startDate : normalizedFallback;
	const normalizedEnd = isDateKey(endDate) ? endDate : normalizedStart;

	if (compareDateKeys(normalizedStart, normalizedEnd) <= 0) {
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

export function resolveDateRangeSelection(
	currentRange: DateRangeValue,
	dateKey: string,
	boundary: DateRangeBoundary
): DateRangeValue {
	if (!isDateKey(dateKey)) return currentRange;

	return normalizeDateRangeValue(
		boundary === 'start' ? dateKey : currentRange.startDate,
		boundary === 'end' ? dateKey : currentRange.endDate,
		currentRange.startDate
	);
}

export function resolveDateRangeSelectionState(
	currentRange: DateRangeValue,
	dateKey: string,
	boundary: DateRangeBoundary
): DateRangeSelectionState {
	const nextRange = resolveDateRangeSelection(currentRange, dateKey, boundary);
	if (!isDateKey(dateKey)) {
		return {
			...nextRange,
			activeBoundary: boundary
		};
	}

	if (boundary === 'start' && nextRange.endDate === dateKey && nextRange.startDate !== dateKey) {
		return {
			...nextRange,
			activeBoundary: 'end'
		};
	}

	if (boundary === 'end' && nextRange.startDate === dateKey && nextRange.endDate !== dateKey) {
		return {
			...nextRange,
			activeBoundary: 'start'
		};
	}

	return {
		...nextRange,
		activeBoundary: boundary
	};
}

export function resolveDateRangeCalendarMonth(
	dateKey: string,
	min?: string,
	max?: string
): MonthReference {
	const parsed = parsePickerValue(dateKey, 'date');
	const fallback = new Date();
	return shiftMonthReference(
		{
			year: parsed?.year ?? fallback.getFullYear(),
			month: parsed?.month ?? fallback.getMonth() + 1
		},
		0,
		'date',
		min,
		max
	);
}

export function resolveDateRangeCalendarMonths(
	startDate: string,
	endDate: string,
	min?: string,
	max?: string
): DateRangeCalendarMonths {
	const normalizedRange = normalizeDateRangeValue(startDate, endDate);
	return {
		startMonth: resolveDateRangeCalendarMonth(normalizedRange.startDate, min, max),
		endMonth: resolveDateRangeCalendarMonth(normalizedRange.endDate, min, max)
	};
}

export function resolveInitialDateRangeMonthReference(
	startDate: string,
	endDate: string,
	min?: string,
	max?: string
): MonthReference {
	const normalizedRange = normalizeDateRangeValue(startDate, endDate);
	const parsedStart = parsePickerValue(normalizedRange.startDate, 'date');
	const fallback = parsedStart
		? { year: parsedStart.year, month: parsedStart.month }
		: {
				year: new Date().getFullYear(),
				month: new Date().getMonth() + 1
			};

	return shiftMonthReference(fallback, 0, 'date', min, max);
}
