export interface AcademicSeasonRange {
	label: string;
	startYear: number;
	startDate: string;
	endDate: string;
}

function formatDateOnly(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function parseDateOnly(value: string): Date | null {
	const normalized = value.trim();
	if (!normalized) return null;
	const parsed = new Date(`${normalized}T00:00:00`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nthWeekdayOfMonth(
	year: number,
	monthIndex: number,
	weekday: number,
	occurrence: number
): Date {
	const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
	const daysUntilWeekday = (weekday - firstOfMonth.getUTCDay() + 7) % 7;
	return new Date(Date.UTC(year, monthIndex, 1 + daysUntilWeekday + (occurrence - 1) * 7));
}

function firstSundayOfMay(year: number): Date {
	return nthWeekdayOfMonth(year, 4, 0, 1);
}

function normalizeAcademicEndYear(startYear: number, rawEndYear: string): number | null {
	const normalized = rawEndYear.trim();
	if (!normalized) return null;

	if (normalized.length === 2) {
		const century = Math.floor(startYear / 100) * 100;
		const candidate = century + Number(normalized);
		return Number.isFinite(candidate) ? candidate : null;
	}

	const candidate = Number(normalized);
	return Number.isFinite(candidate) ? candidate : null;
}

export function buildAcademicSeasonLabel(startYear: number): string {
	return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function getCurrentAcademicSeasonLabel(referenceDate = new Date()): string {
	return buildAcademicSeasonLabel(referenceDate.getFullYear());
}

export function getAcademicSeasonRange(startYear: number): AcademicSeasonRange {
	return {
		label: buildAcademicSeasonLabel(startYear),
		startYear,
		startDate: formatDateOnly(nthWeekdayOfMonth(startYear, 7, 0, 3)),
		endDate: formatDateOnly(firstSundayOfMay(startYear + 1))
	};
}

export function inferAcademicSeasonRangeFromName(name: string): AcademicSeasonRange | null {
	const match = name.match(/\b(20\d{2})\s*[-/]\s*(\d{2}|\d{4})\b/);
	if (!match) return null;

	const startYear = Number(match[1]);
	const endYear = normalizeAcademicEndYear(startYear, match[2]);
	if (!Number.isFinite(startYear) || endYear !== startYear + 1) {
		return null;
	}

	return getAcademicSeasonRange(startYear);
}

export function resolveAcademicSeasonEndDate(seasonName: string, startDate: string): string {
	const inferredRange = inferAcademicSeasonRangeFromName(seasonName);
	if (inferredRange) {
		return inferredRange.endDate;
	}

	const parsedStart = parseDateOnly(startDate);
	if (!parsedStart) return '';

	const sameYearEnd = firstSundayOfMay(parsedStart.getUTCFullYear());
	const resolvedEndYear =
		parsedStart.getTime() <= sameYearEnd.getTime()
			? parsedStart.getUTCFullYear()
			: parsedStart.getUTCFullYear() + 1;

	return formatDateOnly(firstSundayOfMay(resolvedEndYear));
}
