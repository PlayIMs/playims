export interface ClubSeasonHistorySeason {
	id: string;
	name: string;
	startDate: string;
	isCurrent: boolean;
	isActive: boolean;
}

function todayDateString(): string {
	return new Date().toISOString().slice(0, 10);
}

export function seasonStatusLabelForHistory(
	season: ClubSeasonHistorySeason,
	today = todayDateString()
): 'CURRENT' | 'FUTURE' | 'PAST' {
	if (season.isCurrent) return 'CURRENT';
	return season.startDate > today ? 'FUTURE' : 'PAST';
}

export function seasonHistoryRank(
	season: ClubSeasonHistorySeason,
	today = todayDateString()
): number {
	if (season.isCurrent) return 1;
	return season.startDate > today ? 0 : 2;
}

export function compareClubSeasonHistoryOrder(
	a: ClubSeasonHistorySeason,
	b: ClubSeasonHistorySeason,
	today = todayDateString()
): number {
	const rankDiff = seasonHistoryRank(a, today) - seasonHistoryRank(b, today);
	if (rankDiff !== 0) return rankDiff;

	const startDateDiff = b.startDate.localeCompare(a.startDate);
	if (startDateDiff !== 0) return startDateDiff;

	return a.name.localeCompare(b.name);
}

export function resolveDefaultClubSeasonId(
	seasons: ClubSeasonHistorySeason[],
	currentSeasonId: string | null | undefined,
	selectedSeasonId: string
): string {
	const activeSeasons = seasons.filter((season) => season.isActive);
	const seasonPool = activeSeasons.length > 0 ? activeSeasons : seasons;

	if (seasonPool.length === 0) return '';
	if (selectedSeasonId && seasonPool.some((season) => season.id === selectedSeasonId)) {
		return selectedSeasonId;
	}
	if (currentSeasonId && seasonPool.some((season) => season.id === currentSeasonId)) {
		return currentSeasonId;
	}
	return seasonPool[0]?.id ?? '';
}
