import type { ScheduleEventRecord } from '$lib/utils/schedule-page';

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

interface FacilitySlugSelectionOptions {
	facilities: FacilityBoardFacility[];
	areas: FacilityBoardArea[];
	facilitySlug?: string | null;
	areaSlug?: string | null;
}

export interface FacilityTodayUsageEntry {
	eventId: string;
	facilityAreaId: string | null;
	facilityAreaName: string;
	scheduledStartAt: string | null;
	scheduledEndAt: string | null;
	startTimeLabel: string;
	status: ScheduleEventRecord['status'];
	statusLabel: string;
	reasonLabel: string;
	contextLabel: string;
}

export interface FacilityTodayUsageGroup {
	facilityId: string;
	facilitySlug: string | null;
	facilityName: string;
	eventCount: number;
	areasInUseCount: number;
	entries: FacilityTodayUsageEntry[];
}

export interface FacilityTodayUsageSummary {
	facilitiesInUseCount: number;
	areasInUseCount: number;
	eventsTodayCount: number;
	groups: FacilityTodayUsageGroup[];
}

interface FacilityTodayUsageOptions {
	facilities: FacilityBoardFacility[];
	areas: FacilityBoardArea[];
	events: ScheduleEventRecord[];
	now?: Date;
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

	return [
		facility.name,
		facility.slug,
		facility.description,
		facility.addressLine1,
		facility.addressLine2,
		facility.city,
		facility.state,
		facility.postalCode,
		facility.country,
		facility.timezone
	].some((value) => (value ?? '').toLowerCase().includes(query));
}

function sortFacilities(facilities: FacilityBoardFacility[]): FacilityBoardFacility[] {
	return [...facilities].sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));
}

function sortAreas(areas: FacilityBoardArea[]): FacilityBoardArea[] {
	return [...areas].sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));
}

function toDateKey(value: Date | string | null | undefined): string | null {
	if (!value) return null;
	const parsed = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
		parsed.getDate()
	).padStart(2, '0')}`;
}

function formatTimeLabel(value: string | null | undefined): string {
	if (!value) return 'Time TBD';
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return 'Time TBD';
	return parsed.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

function resolveReasonLabel(event: ScheduleEventRecord): string {
	const matchup = event.matchup.trim();
	if (matchup && matchup !== 'TBD vs TBD') return matchup;

	const notes = event.notes?.trim();
	if (notes) return notes;

	const roundLabel = event.roundLabel?.trim();
	if (roundLabel) return roundLabel;

	const leagueName = event.leagueName.trim();
	if (leagueName && leagueName !== 'Unassigned league') return leagueName;

	const offeringName = event.offeringName.trim();
	if (offeringName && offeringName !== 'General') return offeringName;

	return 'Scheduled use';
}

function resolveContextLabel(event: ScheduleEventRecord): string {
	const parts = [
		event.offeringName.trim(),
		event.leagueName.trim(),
		event.roundLabel?.trim() ?? ''
	].filter((part) => part.length > 0 && part !== 'General' && part !== 'Unassigned league');
	return parts.join(' | ');
}

function compareUsageEntries(
	left: FacilityTodayUsageEntry,
	right: FacilityTodayUsageEntry
): number {
	const leftTime = left.scheduledStartAt
		? Date.parse(left.scheduledStartAt)
		: Number.POSITIVE_INFINITY;
	const rightTime = right.scheduledStartAt
		? Date.parse(right.scheduledStartAt)
		: Number.POSITIVE_INFINITY;
	if (leftTime !== rightTime) return leftTime - rightTime;
	return left.reasonLabel.localeCompare(right.reasonLabel);
}

export function buildTodayFacilityUsageSummary({
	facilities,
	areas,
	events,
	now = new Date()
}: FacilityTodayUsageOptions): FacilityTodayUsageSummary {
	const todayKey = toDateKey(now);
	if (!todayKey) {
		return {
			facilitiesInUseCount: 0,
			areasInUseCount: 0,
			eventsTodayCount: 0,
			groups: []
		};
	}

	const facilitiesById = new Map(facilities.map((facility) => [facility.id, facility]));
	const areasById = new Map(areas.map((area) => [area.id, area]));
	const groupMap = new Map<string, FacilityTodayUsageGroup>();
	const areaKeys = new Set<string>();

	for (const event of events) {
		if (!event.facilityId) continue;
		if (event.status === 'cancelled' || event.status === 'postponed') continue;
		if (toDateKey(event.scheduledStartAt) !== todayKey) continue;

		const facility = facilitiesById.get(event.facilityId);
		if (!facility) continue;

		const facilityArea = event.facilityAreaId ? areasById.get(event.facilityAreaId) : null;
		const facilityAreaName =
			facilityArea?.name?.trim() || event.facilityAreaName.trim() || 'Facility-wide';
		const entry: FacilityTodayUsageEntry = {
			eventId: event.id,
			facilityAreaId: event.facilityAreaId,
			facilityAreaName,
			scheduledStartAt: event.scheduledStartAt,
			scheduledEndAt: event.scheduledEndAt,
			startTimeLabel: formatTimeLabel(event.scheduledStartAt),
			status: event.status,
			statusLabel: event.statusLabel,
			reasonLabel: resolveReasonLabel(event),
			contextLabel: resolveContextLabel(event)
		};

		const existingGroup = groupMap.get(facility.id);
		if (existingGroup) {
			existingGroup.entries.push(entry);
			existingGroup.eventCount += 1;
		} else {
			groupMap.set(facility.id, {
				facilityId: facility.id,
				facilitySlug: facility.slug ?? null,
				facilityName: facility.name?.trim() || 'Unnamed facility',
				eventCount: 1,
				areasInUseCount: 0,
				entries: [entry]
			});
		}

		areaKeys.add(`${facility.id}:${entry.facilityAreaId ?? 'facility-wide'}`);
	}

	const groups = [...groupMap.values()]
		.map((group) => {
			group.entries.sort(compareUsageEntries);
			group.areasInUseCount = new Set(
				group.entries.map((entry) => entry.facilityAreaId ?? 'facility-wide')
			).size;
			return group;
		})
		.sort((left, right) => {
			const leftTime = left.entries[0]?.scheduledStartAt
				? Date.parse(left.entries[0].scheduledStartAt)
				: Number.POSITIVE_INFINITY;
			const rightTime = right.entries[0]?.scheduledStartAt
				? Date.parse(right.entries[0].scheduledStartAt)
				: Number.POSITIVE_INFINITY;
			if (leftTime !== rightTime) return leftTime - rightTime;
			return left.facilityName.localeCompare(right.facilityName);
		});

	return {
		facilitiesInUseCount: groups.length,
		areasInUseCount: areaKeys.size,
		eventsTodayCount: groups.reduce((total, group) => total + group.eventCount, 0),
		groups
	};
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

export function resolveFacilitySelectionFromSlugs({
	facilities,
	areas,
	facilitySlug,
	areaSlug
}: FacilitySlugSelectionOptions): {
	facilityId: string | null;
	areaId: string | null;
} {
	const normalizedFacilitySlug = normalizeSearch(facilitySlug ?? '');
	const normalizedAreaSlug = normalizeSearch(areaSlug ?? '');

	const matchedFacility =
		normalizedFacilitySlug.length > 0
			? (facilities.find(
					(facility) => normalizeSearch(facility.slug ?? '') === normalizedFacilitySlug
				) ?? null)
			: null;

	const matchedArea =
		normalizedAreaSlug.length > 0
			? (areas.find((area) => {
					if (normalizeSearch(area.slug ?? '') !== normalizedAreaSlug) return false;
					if (!matchedFacility) return true;
					return area.facilityId === matchedFacility.id;
				}) ?? null)
			: null;

	if (matchedArea?.facilityId) {
		return {
			facilityId: matchedArea.facilityId,
			areaId: matchedArea.id
		};
	}

	if (matchedFacility) {
		return {
			facilityId: matchedFacility.id,
			areaId: null
		};
	}

	return {
		facilityId: null,
		areaId: null
	};
}
