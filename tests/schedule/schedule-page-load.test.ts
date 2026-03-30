/*
Brief description:
This file verifies the server load contract for the dashboard schedule page.

Deeper explanation:
The schedule route now enriches raw events with season context and prepares the filter option data
needed by the redesigned page. These tests protect that contract so the page can render a stable
calendar workspace even when the route is refactored or an error path is triggered.

Summary of tests:
1. It verifies successful loads enrich events with season data and expose all filter option groups.
2. It verifies missing database configuration returns the expanded empty payload shape safely.
3. It verifies unexpected load failures still return the expanded empty payload shape safely.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireAuthenticatedClientId: vi.fn(),
	getTenantDbOps: vi.fn(),
	dbOps: {
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
		divisions: {
			getByLeagueIds: vi.fn()
		},
		facilities: {
			getAll: vi.fn()
		},
		facilityAreas: {
			getAll: vi.fn()
		},
		seasons: {
			getByClientId: vi.fn()
		}
	}
}));

vi.mock('$lib/server/client-context', () => ({
	requireAuthenticatedClientId: mocks.requireAuthenticatedClientId
}));

vi.mock('$lib/server/database/context', () => ({
	getTenantDbOps: mocks.getTenantDbOps
}));

import { load } from '../../src/routes/dashboard/schedule/+page.server';

function createEvent(input?: { withDb?: boolean }) {
	return {
		platform: input?.withDb === false ? { env: {} } : { env: { DB: {} } },
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
		}
	} as any;
}

describe('schedule page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.requireAuthenticatedClientId.mockReturnValue('client-1');
		mocks.getTenantDbOps.mockResolvedValue(mocks.dbOps);

		mocks.dbOps.events.getByClientId.mockResolvedValue([
			{
				id: 'event-1',
				type: 'game',
				status: 'scheduled',
				isActive: 1,
				scheduledStartAt: '2026-03-18T18:00:00.000Z',
				scheduledEndAt: '2026-03-18T19:00:00.000Z',
				offeringId: 'offering-1',
				leagueId: 'league-1',
				divisionId: 'division-1',
				homeTeamId: 'team-1',
				awayTeamId: 'team-2',
				facilityId: 'facility-1',
				facilityAreaId: 'area-1',
				weekNumber: 2,
				roundLabel: 'Regular Season',
				notes: 'Bring dark jerseys.',
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
				name: "Men's Competitive"
			}
		]);
		mocks.dbOps.divisions.getByLeagueIds.mockResolvedValue([
			{
				id: 'division-1',
				name: 'Monday 6 PM'
			}
		]);
		mocks.dbOps.facilities.getAll.mockResolvedValue([
			{
				id: 'facility-1',
				name: 'Main Gym'
			}
		]);
		mocks.dbOps.facilityAreas.getAll.mockResolvedValue([
			{
				id: 'area-1',
				name: 'Court A'
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
	});

	it('enriches schedule events with season data, filter options, and the default season metadata', async () => {
		// this proves the route gives the page enough structured data to drive the new cascading sidebar.
		const result = (await load(createEvent())) as any;

		expect(result.currentSeasonId).toBe('season-1');
		expect(result.currentSeasonName).toBe('Spring 2026');
		expect(result.events[0]).toMatchObject({
			id: 'event-1',
			seasonId: 'season-1',
			seasonName: 'Spring 2026',
			offeringName: 'Basketball',
			leagueName: "Men's Competitive",
			divisionName: 'Monday 6 PM',
			homeTeamName: 'Wildcats',
			awayTeamName: 'Falcons',
			location: 'Main Gym - Court A'
		});
		expect(result.seasonOptions).toEqual([
			{
				value: 'season-1',
				label: 'Spring 2026',
				count: 1
			}
		]);
		expect(result.offeringOptions[0]).toMatchObject({
			value: 'offering-1',
			label: 'Basketball',
			count: 1
		});
		expect(result.leagueOptions[0]).toMatchObject({
			value: 'league-1',
			label: "Men's Competitive",
			count: 1
		});
		expect(result.divisionOptions[0]).toMatchObject({
			value: 'division-1',
			label: 'Monday 6 PM',
			count: 1
		});
		expect(result.teamOptions).toEqual([
			{
				value: 'team-2',
				label: 'Falcons',
				count: 1
			},
			{
				value: 'team-1',
				label: 'Wildcats',
				count: 1
			}
		]);
		expect(result.statusOptions).toEqual([
			{
				value: 'scheduled',
				label: 'Scheduled',
				count: 1
			}
		]);
	});

	it('returns the expanded empty payload when the database is unavailable', async () => {
		// this keeps the page safe to render in local or broken environments where the db binding is missing.
		const result = (await load(createEvent({ withDb: false }))) as any;

		expect(result).toMatchObject({
			currentSeasonId: null,
			currentSeasonName: null,
			events: [],
			seasonOptions: [],
			offeringOptions: [],
			leagueOptions: [],
			divisionOptions: [],
			teamOptions: [],
			statusOptions: [],
			error: 'Database not configured'
		});
	});

	it('returns the expanded empty payload when loading throws unexpectedly', async () => {
		// this ensures the route still returns a predictable shape if one of the backing queries fails.
		mocks.dbOps.events.getByClientId.mockRejectedValueOnce(new Error('boom'));

		const result = (await load(createEvent())) as any;

		expect(result).toMatchObject({
			currentSeasonId: null,
			currentSeasonName: null,
			events: [],
			seasonOptions: [],
			offeringOptions: [],
			leagueOptions: [],
			divisionOptions: [],
			teamOptions: [],
			statusOptions: [],
			error: 'Unable to load schedule right now'
		});
	});
});
