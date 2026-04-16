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
2. It verifies that the shared search can also find facilities through location fields.
3. It verifies that archive mode keeps archived facilities and active facilities with archived areas.
4. It verifies that slug-based deep links resolve to the matching facility and area IDs.
5. It verifies that selection falls back to the first visible facility when the preferred one is gone.
6. It verifies that today's facility usage summary groups active schedule activity by facility and area.
*/

import { describe, expect, it } from 'vitest';
import type { ScheduleEventRecord } from '../../src/lib/utils/schedule-page';
import {
	buildTodayFacilityUsageSummary,
	getVisibleAreasForFacility,
	getVisibleFacilities,
	resolveFacilitySelectionFromSlugs,
	resolveSelectedFacilityId
} from '../../src/routes/dashboard/facilities/facilities-page-state';

const facilities = [
	{
		id: 'facility-1',
		name: 'Turner Center',
		slug: 'turner-center',
		description: 'Main gym building',
		addressLine1: '100 Campus Drive',
		city: 'Oxford',
		state: 'MS',
		isActive: 1
	},
	{
		id: 'facility-2',
		name: 'South Fields',
		slug: 'south-fields',
		description: 'Outdoor complex',
		addressLine1: '250 Recreation Road',
		city: 'Oxford',
		state: 'MS',
		isActive: 1
	},
	{
		id: 'facility-3',
		name: 'Old Natatorium',
		slug: 'old-natatorium',
		description: 'Archived pool building',
		addressLine1: '1 Legacy Lane',
		city: 'Jackson',
		state: 'MS',
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
	},
	{
		id: 'area-5',
		facilityId: 'facility-1',
		name: 'Field 3 Overflow',
		slug: 'field-3',
		description: 'duplicate slug in another facility for slug-resolution testing',
		isActive: 1
	}
];

const scheduleEvents: ScheduleEventRecord[] = [
	{
		id: 'event-1',
		type: 'game',
		status: 'scheduled',
		rawStatus: 'scheduled',
		statusLabel: 'Scheduled',
		scheduledStartAt: '2026-04-16T18:00:00.000Z',
		scheduledEndAt: '2026-04-16T19:00:00.000Z',
		seasonId: 'season-1',
		seasonName: 'Spring 2026',
		offeringId: 'offering-1',
		offeringName: 'Basketball',
		leagueId: 'league-1',
		leagueName: "Men's Competitive",
		divisionId: 'division-1',
		divisionName: 'Court 1',
		homeTeamId: 'team-1',
		homeTeamName: 'Wildcats',
		awayTeamId: 'team-2',
		awayTeamName: 'Falcons',
		matchup: 'Wildcats vs Falcons',
		facilityId: 'facility-1',
		facilityName: 'Turner Center',
		facilityAreaId: 'area-1',
		facilityAreaName: 'Court 1',
		location: 'Turner Center - Court 1',
		weekNumber: 3,
		roundLabel: 'Week 3',
		notes: 'Prime time intramural game',
		isPostseason: false,
		score: null,
		scoreSortValue: 0
	},
	{
		id: 'event-2',
		type: 'practice',
		status: 'in_progress',
		rawStatus: 'in_progress',
		statusLabel: 'Live',
		scheduledStartAt: '2026-04-16T20:00:00.000Z',
		scheduledEndAt: '2026-04-16T21:00:00.000Z',
		seasonId: 'season-1',
		seasonName: 'Spring 2026',
		offeringId: 'offering-2',
		offeringName: 'Volleyball',
		leagueId: 'league-2',
		leagueName: 'Open Rec',
		divisionId: 'division-2',
		divisionName: 'Court 2',
		homeTeamId: null,
		homeTeamName: 'TBD',
		awayTeamId: null,
		awayTeamName: 'TBD',
		matchup: 'TBD vs TBD',
		facilityId: 'facility-1',
		facilityName: 'Turner Center',
		facilityAreaId: 'area-5',
		facilityAreaName: 'Field 3 Overflow',
		location: 'Turner Center - Field 3 Overflow',
		weekNumber: null,
		roundLabel: null,
		notes: 'Open practice block',
		isPostseason: false,
		score: null,
		scoreSortValue: 0
	},
	{
		id: 'event-3',
		type: 'game',
		status: 'completed',
		rawStatus: 'completed',
		statusLabel: 'Completed',
		scheduledStartAt: '2026-04-16T22:00:00.000Z',
		scheduledEndAt: '2026-04-16T23:00:00.000Z',
		seasonId: 'season-1',
		seasonName: 'Spring 2026',
		offeringId: 'offering-3',
		offeringName: 'Soccer',
		leagueId: 'league-3',
		leagueName: 'Co-Rec',
		divisionId: 'division-3',
		divisionName: 'Field 3',
		homeTeamId: 'team-3',
		homeTeamName: 'Reds',
		awayTeamId: 'team-4',
		awayTeamName: 'Blues',
		matchup: 'Reds vs Blues',
		facilityId: 'facility-2',
		facilityName: 'South Fields',
		facilityAreaId: 'area-2',
		facilityAreaName: 'Field 3',
		location: 'South Fields - Field 3',
		weekNumber: 5,
		roundLabel: 'Semi Final',
		notes: null,
		isPostseason: true,
		score: '2 - 1',
		scoreSortValue: 1
	},
	{
		id: 'event-4',
		type: 'game',
		status: 'cancelled',
		rawStatus: 'cancelled',
		statusLabel: 'Cancelled',
		scheduledStartAt: '2026-04-16T16:00:00.000Z',
		scheduledEndAt: '2026-04-16T17:00:00.000Z',
		seasonId: 'season-1',
		seasonName: 'Spring 2026',
		offeringId: 'offering-4',
		offeringName: 'Flag Football',
		leagueId: 'league-4',
		leagueName: 'Tuesday',
		divisionId: 'division-4',
		divisionName: 'Field 4',
		homeTeamId: 'team-5',
		homeTeamName: 'A',
		awayTeamId: 'team-6',
		awayTeamName: 'B',
		matchup: 'A vs B',
		facilityId: 'facility-2',
		facilityName: 'South Fields',
		facilityAreaId: 'area-2',
		facilityAreaName: 'Field 3',
		location: 'South Fields - Field 3',
		weekNumber: null,
		roundLabel: null,
		notes: null,
		isPostseason: false,
		score: null,
		scoreSortValue: 0
	},
	{
		id: 'event-5',
		type: 'game',
		status: 'scheduled',
		rawStatus: 'scheduled',
		statusLabel: 'Scheduled',
		scheduledStartAt: '2026-04-17T18:00:00.000Z',
		scheduledEndAt: '2026-04-17T19:00:00.000Z',
		seasonId: 'season-1',
		seasonName: 'Spring 2026',
		offeringId: 'offering-5',
		offeringName: 'Softball',
		leagueId: 'league-5',
		leagueName: 'Thursday',
		divisionId: 'division-5',
		divisionName: 'Field 1',
		homeTeamId: 'team-7',
		homeTeamName: 'Owls',
		awayTeamId: 'team-8',
		awayTeamName: 'Bears',
		matchup: 'Owls vs Bears',
		facilityId: 'facility-1',
		facilityName: 'Turner Center',
		facilityAreaId: 'area-1',
		facilityAreaName: 'Court 1',
		location: 'Turner Center - Court 1',
		weekNumber: null,
		roundLabel: null,
		notes: null,
		isPostseason: false,
		score: null,
		scoreSortValue: 0
	},
	{
		id: 'event-6',
		type: 'meeting',
		status: 'scheduled',
		rawStatus: 'scheduled',
		statusLabel: 'Scheduled',
		scheduledStartAt: '2026-04-16T15:00:00.000Z',
		scheduledEndAt: '2026-04-16T16:00:00.000Z',
		seasonId: null,
		seasonName: 'Unassigned season',
		offeringId: null,
		offeringName: 'General',
		leagueId: null,
		leagueName: 'Unassigned league',
		divisionId: null,
		divisionName: 'Unassigned division',
		homeTeamId: null,
		homeTeamName: 'TBD',
		awayTeamId: null,
		awayTeamName: 'TBD',
		matchup: 'TBD vs TBD',
		facilityId: null,
		facilityName: 'TBD location',
		facilityAreaId: null,
		facilityAreaName: '',
		location: 'TBD location',
		weekNumber: null,
		roundLabel: null,
		notes: 'Staff planning meeting',
		isPostseason: false,
		score: null,
		scoreSortValue: 0
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

	it('matches facilities through location fields when using the shared search bar', () => {
		const visibleFacilities = getVisibleFacilities(facilities, areas, {
			viewArchiveMode: false,
			facilitySearch: 'recreation road'
		});

		// this locks the single search bar to facility location text, not just names
		expect(visibleFacilities.map((facility) => facility.id)).toEqual(['facility-2']);
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

	it('resolves slug-based deep links to the matching facility and area ids', () => {
		const selection = resolveFacilitySelectionFromSlugs({
			facilities,
			areas,
			facilitySlug: 'south-fields',
			areaSlug: 'field-3'
		});

		// this keeps the url human-readable while still letting the page focus the real records
		expect(selection).toEqual({
			facilityId: 'facility-2',
			areaId: 'area-2'
		});
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

	it("groups today's active facility usage into a sidebar-friendly summary", () => {
		const summary = buildTodayFacilityUsageSummary({
			facilities,
			areas,
			events: scheduleEvents,
			now: new Date('2026-04-16T10:00:00.000Z')
		});

		// this locks the sidebar summary to today's real facility activity, not cancelled items or future events
		expect(summary).toMatchObject({
			facilitiesInUseCount: 2,
			areasInUseCount: 3,
			eventsTodayCount: 3
		});
		expect(summary.groups.map((group) => group.facilityId)).toEqual(['facility-1', 'facility-2']);
		expect(summary.groups[0]).toMatchObject({
			facilityName: 'Turner Center',
			eventCount: 2,
			areasInUseCount: 2
		});
		expect(summary.groups[1]).toMatchObject({
			facilityName: 'South Fields',
			eventCount: 1,
			areasInUseCount: 1
		});
		expect(summary.groups[0].entries[0]).toMatchObject({
			facilityAreaName: 'Court 1',
			statusLabel: 'Scheduled',
			reasonLabel: 'Wildcats vs Falcons',
			contextLabel: "Basketball | Men's Competitive | Week 3"
		});
		expect(summary.groups[0].entries[1]).toMatchObject({
			facilityAreaName: 'Field 3 Overflow',
			statusLabel: 'Live',
			reasonLabel: 'Open practice block',
			contextLabel: 'Volleyball | Open Rec'
		});
	});
});
