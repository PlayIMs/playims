interface SearchSeasonLike {
	id: string;
	name: string;
	slug: string;
	startDate: string;
	endDate?: string | null;
	isCurrent: boolean;
	isActive: boolean;
}

function sortSeasonsDescending<T extends SearchSeasonLike>(a: T, b: T): number {
	return b.startDate.localeCompare(a.startDate);
}

export function resolveSearchPaletteDefaultSeasonId<T extends SearchSeasonLike>(
	seasons: readonly T[]
): string {
	const sortedSeasons = [...seasons].sort(sortSeasonsDescending);
	const currentSeason = sortedSeasons.find((season) => season.isCurrent);
	if (currentSeason) return currentSeason.id;
	const activeSeason = sortedSeasons.find((season) => season.isActive);
	return activeSeason?.id ?? sortedSeasons[0]?.id ?? '';
}

export function resolveSearchPaletteSeasonStatusLabel(
	season: SearchSeasonLike,
	todayIsoDate: string
): 'CURRENT' | 'PAST' | 'FUTURE' {
	if (season.isCurrent) return 'CURRENT';
	return season.startDate > todayIsoDate ? 'FUTURE' : 'PAST';
}

export function buildSearchPaletteSeasonDropdownOptions<T extends SearchSeasonLike>(
	seasons: readonly T[],
	todayIsoDate: string
): Array<{ value: string; label: string; statusLabel: 'CURRENT' | 'PAST' | 'FUTURE' }> {
	return [...seasons]
		.filter((season) => season.isActive)
		.sort(sortSeasonsDescending)
		.map((season) => ({
			value: season.id,
			label: season.name,
			statusLabel: resolveSearchPaletteSeasonStatusLabel(season, todayIsoDate)
		}));
}

export function resolveSearchPaletteScopedSeasonSlug<T extends SearchSeasonLike>(
	seasons: readonly T[],
	seasonId: string | null | undefined
): string | null {
	const normalizedSeasonId = seasonId?.trim() ?? '';
	if (!normalizedSeasonId) return null;
	return seasons.find((season) => season.id === normalizedSeasonId)?.slug ?? null;
}
