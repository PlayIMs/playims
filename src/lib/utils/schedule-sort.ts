const DAY_OF_WEEK_ORDER = new Map<string, number>([
	['sunday', 0],
	['sun', 0],
	['monday', 1],
	['mon', 1],
	['tuesday', 2],
	['tue', 2],
	['tues', 2],
	['wednesday', 3],
	['wed', 3],
	['thursday', 4],
	['thu', 4],
	['thur', 4],
	['thurs', 4],
	['friday', 5],
	['fri', 5],
	['saturday', 6],
	['sat', 6]
]);

export interface ScheduleSortable {
	dayOfWeek?: string | null;
	gameTime?: string | null;
	name?: string | null;
}

export function dayOfWeekSortValue(value: string | null | undefined): number {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) return Number.MAX_SAFE_INTEGER;
	return DAY_OF_WEEK_ORDER.get(normalized) ?? Number.MAX_SAFE_INTEGER;
}

export function timeSortValue(value: string | null | undefined): number {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) return Number.MAX_SAFE_INTEGER;

	const meridiemMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*([ap])m$/i);
	if (meridiemMatch) {
		let hour = Number(meridiemMatch[1]) % 12;
		const minute = Number(meridiemMatch[2]);
		if (meridiemMatch[3].toLowerCase() === 'p') hour += 12;
		return hour * 60 + minute;
	}

	const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
	if (twentyFourHourMatch) {
		const hour = Number(twentyFourHourMatch[1]);
		const minute = Number(twentyFourHourMatch[2]);
		if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
			return hour * 60 + minute;
		}
	}

	return Number.MAX_SAFE_INTEGER;
}

export function compareByDayOfWeekAndTime<T extends ScheduleSortable>(a: T, b: T): number {
	const dayDiff = dayOfWeekSortValue(a.dayOfWeek) - dayOfWeekSortValue(b.dayOfWeek);
	if (dayDiff !== 0) return dayDiff;

	const timeDiff = timeSortValue(a.gameTime) - timeSortValue(b.gameTime);
	if (timeDiff !== 0) return timeDiff;

	return (a.name?.trim() || '').localeCompare(b.name?.trim() || '');
}
