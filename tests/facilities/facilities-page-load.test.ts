/*
Brief description:
This file verifies the server load contract for the dashboard facilities page.

Deeper explanation:
The facilities page now includes a right-side summary panel that depends on server-computed counts
and today's facility usage data. These tests protect that load payload so the facilities board can
keep rendering its summary sidebar even if the route is refactored later.

Summary of tests:
1. It verifies successful loads return facilities, areas, slug-based selection, and today's usage groups.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireAuthenticatedClientId: vi.fn(),
	getTenantDbOps: vi.fn(),
	readFacilitySearchSelection: vi.fn(),
	dbOps: {
		facilities: {
			getAll: vi.fn()
		},
		facilityAreas: {
			getAll: vi.fn()
		},
		events: {
			getByClientId: vi.fn()
		},
		teams: {
			getByClientId: vi.fn()
		},
		offerings: {
			getByClientId: vi.fn()
		},
		leagues: {
			getByClientId: vi.fn()
		},
		seasons: {
			getByClientId: vi.fn()
		},
		divisions: {
			getByLeagueIds: vi.fn()
		}
	}
}));

vi.mock('$lib/server/client-context', () => ({
	requireAuthenticatedClientId: mocks.requireAuthenticatedClientId
}));

vi.mock('$lib/server/database/context', () => ({
	getTenantDbOps: mocks.getTenantDbOps
}));

vi.mock('$lib/search/page-state.js', () => ({
	readFacilitySearchSelection: mocks.readFacilitySearchSelection
}));

import { load } from '../../src/routes/dashboard/facilities/+page.server';

function createLoadEvent() {
	return {
		platform: { env: { DB: {} } },
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role: 'admin'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role: 'admin'
			}
		},
		url: new URL('https://example.test/dashboard/facilities?facility=turner-center&area=court-1')
	} as any;
}

describe('facilities page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-16T10:00:00.000Z'));

		mocks.requireAuthenticatedClientId.mockReturnValue('client-1');
		mocks.getTenantDbOps.mockResolvedValue(mocks.dbOps);
		mocks.readFacilitySearchSelection.mockReturnValue({
			facilitySlug: 'turner-center',
			areaSlug: 'court-1'
		});

		mocks.dbOps.facilities.getAll.mockResolvedValue([
			{
				id: 'facility-1',
				name: 'Turner Center',
				slug: 'turner-center',
				isActive: 1
			}
		]);
		mocks.dbOps.facilityAreas.getAll.mockResolvedValue([
			{
				id: 'area-1',
				facilityId: 'facility-1',
				name: 'Court 1',
				slug: 'court-1',
				isActive: 1
			}
		]);
		mocks.dbOps.events.getByClientId.mockResolvedValue([
			{
				id: 'event-1',
				type: 'game',
				status: 'scheduled',
				isActive: 1,
				scheduledStartAt: '2026-04-16T18:00:00.000Z',
				scheduledEndAt: '2026-04-16T19:00:00.000Z',
				offeringId: 'offering-1',
				leagueId: 'league-1',
				divisionId: 'division-1',
				homeTeamId: 'team-1',
				awayTeamId: 'team-2',
				facilityId: 'facility-1',
				facilityAreaId: 'area-1',
				weekNumber: 3,
				roundLabel: 'Week 3',
				notes: null,
				isPostseason: 0,
				homeScore: null,
				awayScore: null
			}
		]);
		mocks.dbOps.teams.getByClientId.mockResolvedValue([
			{ id: 'team-1', name: 'Wildcats' },
			{ id: 'team-2', name: 'Falcons' }
		]);
		mocks.dbOps.offerings.getByClientId.mockResolvedValue([
			{
				id: 'offering-1',
				name: 'Basketball',
				seasonId: 'season-1'
			}
		]);
		mocks.dbOps.leagues.getByClientId.mockResolvedValue([
			{
				id: 'league-1',
				name: "Men's Competitive",
				offeringId: 'offering-1'
			}
		]);
		mocks.dbOps.seasons.getByClientId.mockResolvedValue([
			{
				id: 'season-1',
				name: 'Spring 2026',
				startDate: '2026-01-15',
				endDate: '2026-05-15',
				isCurrent: 1
			}
		]);
		mocks.dbOps.divisions.getByLeagueIds.mockResolvedValue([
			{
				id: 'division-1',
				name: 'Court 1',
				leagueId: 'league-1'
			}
		]);
	});

	it("returns today's facility usage summary alongside slug-based selection data", async () => {
		// this proves the sidebar can render from the facilities route without making a second client fetch
		const result = (await load(createLoadEvent())) as any;

		expect(result.clientId).toBe('client-1');
		expect(result.facilityId).toBe('facility-1');
		expect(result.areaId).toBe('area-1');
		expect(result.todayFacilityUsage).toMatchObject({
			facilitiesInUseCount: 1,
			areasInUseCount: 1,
			eventsTodayCount: 1,
			groups: [
				{
					facilityId: 'facility-1',
					facilityName: 'Turner Center',
					eventCount: 1,
					entries: [
						{
							facilityAreaName: 'Court 1',
							reasonLabel: 'Wildcats vs Falcons',
							contextLabel: "Basketball | Men's Competitive | Week 3"
						}
					]
				}
			]
		});
	});
});
