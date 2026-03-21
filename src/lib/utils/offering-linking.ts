const normalizeOfferingText = (value: string | null | undefined): string =>
	value?.trim().toLowerCase() ?? '';

const normalizeOfferingSlug = (value: string | null | undefined): string => {
	if (!value) return '';
	return value
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
};

export interface OfferingSeriesBackfillRecord {
	id: string;
	name: string | null | undefined;
	seriesId: string | null | undefined;
}

export interface OfferingLinkSeasonRecord {
	id: string;
	name: string;
	startDate: string;
}

export interface OfferingLinkRecord {
	id: string;
	name: string | null | undefined;
	slug: string | null | undefined;
	seasonId: string | null | undefined;
	seasonName: string | null | undefined;
	seriesId: string | null | undefined;
	isActive: boolean;
}

export interface PreviousOfferingLinkChoice {
	id: string;
	name: string;
	slug: string;
	seriesId: string | null;
	seasonId: string | null;
	seasonName: string | null;
	seasonNames: string[];
	seasonCount: number;
}

export function buildOfferingSeriesBackfillPlan(
	offerings: OfferingSeriesBackfillRecord[],
	createSeriesId: () => string
): Array<{ offeringId: string; seriesId: string }> {
	const offeringsByName = new Map<string, OfferingSeriesBackfillRecord[]>();

	for (const offering of offerings) {
		const normalizedName = normalizeOfferingText(offering.name);
		if (!offering.id || !normalizedName) continue;
		const group = offeringsByName.get(normalizedName) ?? [];
		group.push(offering);
		offeringsByName.set(normalizedName, group);
	}

	const updates: Array<{ offeringId: string; seriesId: string }> = [];

	for (const group of offeringsByName.values()) {
		if (group.length < 2) continue;
		const existingSeriesIds = Array.from(
			new Set(group.map((offering) => offering.seriesId?.trim()).filter((seriesId) => Boolean(seriesId)))
		) as string[];
		const targetSeriesId = existingSeriesIds[0] ?? createSeriesId();

		for (const offering of group) {
			if (offering.seriesId?.trim() === targetSeriesId) continue;
			updates.push({
				offeringId: offering.id,
				seriesId: targetSeriesId
			});
		}
	}

	return updates;
}

export function buildPreviousOfferingLinkChoices(input: {
	offerings: OfferingLinkRecord[];
	seasons: OfferingLinkSeasonRecord[];
	selectedSeasonId: string;
	offeringName: string;
	offeringSlug: string;
}): PreviousOfferingLinkChoice[] {
	const selectedSeasonId = input.selectedSeasonId.trim();
	const normalizedName = normalizeOfferingText(input.offeringName);
	const normalizedSlug = normalizeOfferingSlug(input.offeringSlug);
	if (!selectedSeasonId || (!normalizedName && !normalizedSlug)) {
		return [];
	}

	const seasonsById = new Map(input.seasons.map((season) => [season.id, season]));
	const selectedSeason = seasonsById.get(selectedSeasonId);
	if (!selectedSeason) return [];

	const matchingOfferings = input.offerings.filter((offering) => {
		if (!offering.id) return false;
		const seasonId = offering.seasonId?.trim() ?? '';
		if (!seasonId || seasonId === selectedSeasonId) return false;
		const offeringSeason = seasonsById.get(seasonId);
		if (!offeringSeason || offeringSeason.startDate >= selectedSeason.startDate) return false;

		const namesMatch = normalizeOfferingText(offering.name) === normalizedName;
		const slugsMatch = normalizeOfferingSlug(offering.slug) === normalizedSlug;
		return namesMatch || slugsMatch;
	});

	const groupedChoices = new Map<string, PreviousOfferingLinkChoice>();

	for (const offering of matchingOfferings) {
		const groupingKey =
			offering.seriesId?.trim() || `name:${normalizeOfferingText(offering.name)}`;
		const seasonName = offering.seasonName?.trim() || seasonsById.get(offering.seasonId ?? '')?.name || null;
		const existingChoice = groupedChoices.get(groupingKey);

		if (!existingChoice) {
			groupedChoices.set(groupingKey, {
				id: offering.id,
				name: offering.name?.trim() || 'Untitled Offering',
				slug: offering.slug?.trim() || '',
				seriesId: offering.seriesId?.trim() || null,
				seasonId: offering.seasonId?.trim() || null,
				seasonName,
				seasonNames: seasonName ? [seasonName] : [],
				seasonCount: seasonName ? 1 : 0
			});
			continue;
		}

		const nextSeason = offering.seasonId ? seasonsById.get(offering.seasonId) : null;
		const existingSeason = existingChoice.seasonId ? seasonsById.get(existingChoice.seasonId) : null;
		if (
			nextSeason?.startDate &&
			(!existingSeason?.startDate || nextSeason.startDate > existingSeason.startDate)
		) {
			existingChoice.id = offering.id;
			existingChoice.seasonId = offering.seasonId?.trim() || null;
			existingChoice.seasonName = seasonName;
		}

		if (seasonName && !existingChoice.seasonNames.includes(seasonName)) {
			existingChoice.seasonNames = [...existingChoice.seasonNames, seasonName];
			existingChoice.seasonCount = existingChoice.seasonNames.length;
		}
	}

	return [...groupedChoices.values()]
		.map((choice) => ({
			...choice,
			seasonNames: [...choice.seasonNames].sort((a, b) => {
				const seasonA = input.seasons.find((season) => season.name === a);
				const seasonB = input.seasons.find((season) => season.name === b);
				return (seasonA?.startDate ?? '').localeCompare(seasonB?.startDate ?? '');
			}),
			seasonCount: choice.seasonNames.length
		}))
		.sort((a, b) => {
			const seasonA = a.seasonId ? seasonsById.get(a.seasonId) : null;
			const seasonB = b.seasonId ? seasonsById.get(b.seasonId) : null;
			const dateA = seasonA?.startDate ?? '';
			const dateB = seasonB?.startDate ?? '';
			if (dateA !== dateB) return dateB.localeCompare(dateA);
			return a.name.localeCompare(b.name);
		});
}
