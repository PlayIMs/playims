export type DateTooltipValue = string | number | Date | null | undefined;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export function parseDateTooltipValue(value: DateTooltipValue): Date | null {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		return value;
	}

	if (typeof value === 'number') {
		const parsedFromNumber = new Date(value);
		if (Number.isNaN(parsedFromNumber.getTime())) return null;
		return parsedFromNumber;
	}

	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	if (!normalized) return null;

	const dateOnlyMatch = normalized.match(DATE_ONLY_PATTERN);
	if (dateOnlyMatch) {
		const year = Number(dateOnlyMatch[1]);
		const monthIndex = Number(dateOnlyMatch[2]) - 1;
		const day = Number(dateOnlyMatch[3]);
		const parsedFromDateOnly = new Date(year, monthIndex, day);
		if (Number.isNaN(parsedFromDateOnly.getTime())) return null;
		return parsedFromDateOnly;
	}

	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed;
}

function valueIncludesTime(value: DateTooltipValue): boolean {
	if (typeof value === 'string') {
		return DATE_TIME_PATTERN.test(value.trim());
	}

	if (typeof value === 'number') return true;
	if (value instanceof Date) return true;
	return false;
}

function resolveTimezoneShortCode(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZoneName: 'short'
	}).formatToParts(date);
	return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
}

function formatFullDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	}).format(date);
}

function formatTime(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	})
		.format(date)
		.replace(/\s+([AP]M)$/i, ' $1');
}

function formatTooltipDate(date: Date, includeTime: boolean): string {
	const fullDate = formatFullDate(date);
	if (!includeTime) return fullDate;
	const timeText = formatTime(date);
	const timezoneShortCode = resolveTimezoneShortCode(date);
	if (!timezoneShortCode) return `${fullDate}, ${timeText}`;
	return `${fullDate}, ${timeText} ${timezoneShortCode}`;
}

export function buildDateTooltipText(input: {
	value: DateTooltipValue;
	endValue?: DateTooltipValue;
	includeTime?: boolean;
	display?: string;
}): string {
	// Visible precision takes precedence over stored timestamps or legacy caller flags.
	const visibleHasTime =
		input.display === undefined
			? undefined
			: /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*[AP]M\b/i.test(input.display);
	const parseValue = (value: DateTooltipValue) => {
		// Match legacy datetime labels that format date-only strings through new Date (UTC).
		if (visibleHasTime && typeof value === 'string' && DATE_ONLY_PATTERN.test(value.trim())) {
			return new Date(value.trim());
		}
		return parseDateTooltipValue(value);
	};
	const startDate = parseValue(input.value);
	const endDate = parseValue(input.endValue);
	if (!startDate && !endDate) return '';

	const hasTimeValue =
		valueIncludesTime(input.value) ||
		(input.endValue !== undefined && valueIncludesTime(input.endValue));

	const resolvedIncludeTime =
		visibleHasTime ?? ((input.includeTime ?? hasTimeValue) && hasTimeValue);

	if (startDate && endDate) {
		return `${formatTooltipDate(startDate, resolvedIncludeTime)} - ${formatTooltipDate(endDate, resolvedIncludeTime)}`;
	}

	return formatTooltipDate(startDate ?? endDate!, resolvedIncludeTime);
}
