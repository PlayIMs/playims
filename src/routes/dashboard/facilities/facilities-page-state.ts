export interface FacilityBoardFacility {
	id: string;
	name: string | null;
	slug: string | null;
	description?: string | null;
	isActive: number | null;
	addressLine1?: string | null;
	addressLine2?: string | null;
	city?: string | null;
	state?: string | null;
	postalCode?: string | null;
	country?: string | null;
	timezone?: string | null;
	capacity?: number | null;
}

export interface FacilityBoardArea {
	id: string;
	facilityId: string | null;
	name: string | null;
	slug: string | null;
	description?: string | null;
	isActive: number | null;
	capacity?: number | null;
}

interface FacilityVisibilityOptions {
	viewArchiveMode: boolean;
	facilitySearch: string;
}

interface AreaVisibilityOptions extends FacilityVisibilityOptions {
	areaSearch: string;
}

interface FacilitySelectionOptions {
	visibleFacilities: FacilityBoardFacility[];
	preferredFacilityId?: string | null;
	currentSelectedFacilityId?: string | null;
}

function normalizeSearch(value: string): string {
	return value.trim().toLowerCase();
}

function isAreaMatch(area: FacilityBoardArea, query: string): boolean {
	if (!query) return false;

	return [area.name, area.slug, area.description].some((value) =>
		(value ?? '').toLowerCase().includes(query)
	);
}

function isFacilityMatch(facility: FacilityBoardFacility, query: string): boolean {
	if (!query) return false;

	return [facility.name, facility.slug, facility.description].some((value) =>
		(value ?? '').toLowerCase().includes(query)
	);
}

function sortFacilities(facilities: FacilityBoardFacility[]): FacilityBoardFacility[] {
	return [...facilities].sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));
}

function sortAreas(areas: FacilityBoardArea[]): FacilityBoardArea[] {
	return [...areas].sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));
}

export function getVisibleFacilities(
	facilities: FacilityBoardFacility[],
	areas: FacilityBoardArea[],
	options: FacilityVisibilityOptions
): FacilityBoardFacility[] {
	const facilityQuery = normalizeSearch(options.facilitySearch);
	const matchingAreaFacilityIds = new Set(
		areas.filter((area) => isAreaMatch(area, facilityQuery)).map((area) => area.facilityId ?? '')
	);

	const visibleFacilities = facilities.filter((facility) => {
		const hasArchivedAreas = areas.some(
			(area) => area.facilityId === facility.id && area.isActive === 0
		);

		if (options.viewArchiveMode) {
			return facility.isActive === 0 || hasArchivedAreas;
		}

		return facility.isActive !== 0;
	});

	if (!facilityQuery) {
		return sortFacilities(visibleFacilities);
	}

	return sortFacilities(
		visibleFacilities.filter(
			(facility) =>
				isFacilityMatch(facility, facilityQuery) || matchingAreaFacilityIds.has(facility.id)
		)
	);
}

export function getVisibleAreasForFacility(
	areas: FacilityBoardArea[],
	facilityId: string,
	options: AreaVisibilityOptions
): FacilityBoardArea[] {
	const facilityQuery = normalizeSearch(options.facilitySearch);
	const areaQuery = normalizeSearch(options.areaSearch);

	return sortAreas(
		areas
			.filter((area) => area.facilityId === facilityId)
			.filter((area) => (options.viewArchiveMode ? area.isActive === 0 : area.isActive !== 0))
			.filter((area) => {
				if (facilityQuery && isAreaMatch(area, facilityQuery)) return true;
				if (!areaQuery) return !facilityQuery || isAreaMatch(area, facilityQuery);
				return isAreaMatch(area, areaQuery);
			})
	);
}

export function resolveSelectedFacilityId({
	visibleFacilities,
	preferredFacilityId,
	currentSelectedFacilityId
}: FacilitySelectionOptions): string | null {
	const visibleIds = new Set(visibleFacilities.map((facility) => facility.id));

	if (preferredFacilityId && visibleIds.has(preferredFacilityId)) {
		return preferredFacilityId;
	}

	if (currentSelectedFacilityId && visibleIds.has(currentSelectedFacilityId)) {
		return currentSelectedFacilityId;
	}

	return visibleFacilities[0]?.id ?? null;
}
