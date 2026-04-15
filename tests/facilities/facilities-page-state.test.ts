/*
Brief description:
This file verifies the facility board helper that powers the facilities page layout and selection state.

Deeper explanation:
The facilities page is moving toward a split workspace with a searchable list on the left and a
context panel on the right. That adds UI state around filtering, archive mode, and fallback
selection. These tests lock down that page-state logic in a small pure helper so we can redesign the
page without guessing how facilities and areas should appear.

Summary of tests:
1. It verifies that active mode shows active facilities and can match them through area search.
2. It verifies that archive mode keeps archived facilities and active facilities with archived areas.
3. It verifies that selection falls back to the first visible facility when the preferred one is gone.
*/

import { describe, expect, it } from 'vitest';
import {
	getVisibleAreasForFacility,
	getVisibleFacilities,
	resolveSelectedFacilityId
} from '../../src/routes/dashboard/facilities/facilities-page-state';

const facilities = [
	{
		id: 'facility-1',
		name: 'Turner Center',
		slug: 'turner-center',
		description: 'Main gym building',
		isActive: 1
	},
	{
		id: 'facility-2',
		name: 'South Fields',
		slug: 'south-fields',
		description: 'Outdoor complex',
		isActive: 1
	},
	{
		id: 'facility-3',
		name: 'Old Natatorium',
		slug: 'old-natatorium',
		description: 'Archived pool building',
		isActive: 0
	}
];

const areas = [
	{
		id: 'area-1',
		facilityId: 'facility-1',
		name: 'Court 1',
		slug: 'court-1',
		description: 'Basketball court',
		isActive: 1
	},
	{
		id: 'area-2',
		facilityId: 'facility-2',
		name: 'Field 3',
		slug: 'field-3',
		description: 'Grass field',
		isActive: 1
	},
	{
		id: 'area-3',
		facilityId: 'facility-2',
		name: 'Legacy Storage',
		slug: 'legacy-storage',
		description: 'Archived support area',
		isActive: 0
	},
	{
		id: 'area-4',
		facilityId: 'facility-3',
		name: 'Pool Deck',
		slug: 'pool-deck',
		description: 'Archived pool deck',
		isActive: 0
	}
];

describe('facilities page state', () => {
	it('shows active facilities and matches them through area search in active mode', () => {
		const visibleFacilities = getVisibleFacilities(facilities, areas, {
			viewArchiveMode: false,
			facilitySearch: 'court'
		});

		expect(visibleFacilities.map((facility) => facility.id)).toEqual(['facility-1']);

		const visibleAreas = getVisibleAreasForFacility(areas, 'facility-1', {
			viewArchiveMode: false,
			facilitySearch: 'court',
			areaSearch: ''
		});

		expect(visibleAreas.map((area) => area.id)).toEqual(['area-1']);
	});

	it('keeps archived facilities and partially archived facilities in archive mode', () => {
		const visibleFacilities = getVisibleFacilities(facilities, areas, {
			viewArchiveMode: true,
			facilitySearch: ''
		});

		expect(visibleFacilities.map((facility) => facility.id)).toEqual(['facility-3', 'facility-2']);

		const visibleAreas = getVisibleAreasForFacility(areas, 'facility-2', {
			viewArchiveMode: true,
			facilitySearch: '',
			areaSearch: ''
		});

		expect(visibleAreas.map((area) => area.id)).toEqual(['area-3']);
	});

	it('falls back to the first visible facility when the preferred selection is hidden', () => {
		const visibleFacilities = getVisibleFacilities(facilities, areas, {
			viewArchiveMode: false,
			facilitySearch: 'south'
		});

		const selectedFacilityId = resolveSelectedFacilityId({
			visibleFacilities,
			preferredFacilityId: 'facility-1',
			currentSelectedFacilityId: 'facility-1'
		});

		expect(selectedFacilityId).toBe('facility-2');
	});
});
