/*
Brief description:
This file verifies the server load behavior for the offerings team detail page.

Deeper explanation:
The team detail route now composes nested context, roster data, standings, and schedule rows from
multiple operations. These tests keep the route contract stable so the team page remains safe to
navigate and continues returning predictable data even as surrounding offering logic evolves.

Summary of tests:
1. It verifies that a matching team returns roster, standings, and schedule data for rendering.
2. It verifies that a missing team slug redirects back to the offerings index.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		requireAuthenticatedClientId: vi.fn(),
		getTenantDbOps: vi.fn(),
		resolveOfferingForSeason: vi.fn(),
		resolveLeagueForOffering: vi.fn(),
		dbOps: {
			seasons: {
				getByClientIdAndSlug: vi.fn(),
				getCurrentByClientId: vi.fn()
			},
			offerings: {
				getByClientId: vi.fn()
			},
			leagues: {
				getByClientId: vi.fn()
			},
			divisions: {
				getByLeagueId: vi.fn()
			},
			teams: {
				getByClientIdAndDivisionIds: vi.fn()
			},
			rosters: {
				getByClientIdAndTeamIds: vi.fn()
			},
			users: {
				getByClientId: vi.fn()
			},
			divisionStandings: {
				getByClientIdAndLeagueId: vi.fn()
			},
			events: {
				getByClientId: vi.fn()
			},
			facilities: {
				getAll: vi.fn()
			},
			facilityAreas: {
				getAll: vi.fn()
			}
		}
	};
});

vi.mock('$lib/server/client-context', () => ({
	requireAuthenticatedClientId: mocks.requireAuthenticatedClientId
}));

vi.mock('$lib/server/database/context', () => ({
	getTenantDbOps: mocks.getTenantDbOps
}));

vi.mock('$lib/server/intramural-offering-scope', () => ({
	offeringMatchesSeason: vi.fn(() => true),
	resolveOfferingNavigationSeason: vi.fn((currentSeason, season) => currentSeason ?? season),
	resolveOfferingForSeason: mocks.resolveOfferingForSeason,
	resolveLeagueForOffering: mocks.resolveLeagueForOffering
}));

import { load } from '../../src/routes/dashboard/offerings/[seasonSlug]/[offeringSlug]/[leagueSlug]/[divisionSlug]/[teamSlug]/+page.server';

const createEvent = (params?: Partial<Record<string, string>>) =>
	({
		params: {
			seasonSlug: 'spring-2026',
			offeringSlug: 'basketball',
			leagueSlug: 'mens-competitive',
			divisionSlug: 'monday-500-pm',
			teamSlug: 'wildcats',
			...(params ?? {})
		},
		platform: {
			env: {
				DB: {}
			}
		},
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
	}) as any;

describe('team detail page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.requireAuthenticatedClientId.mockReturnValue('client-1');
		mocks.getTenantDbOps.mockResolvedValue(mocks.dbOps);
		mocks.resolveOfferingForSeason.mockResolvedValue({
			id: 'off-1',
			name: 'Basketball',
			slug: 'basketball',
			sport: 'Basketball',
			description: null,
			maxPlayers: 12
		});
		mocks.resolveLeagueForOffering.mockResolvedValue({
			id: 'league-1',
			offeringId: 'off-1',
			name: "Men's Competitive",
			slug: 'mens-competitive',
			description: null
		});

		mocks.dbOps.seasons.getByClientIdAndSlug.mockResolvedValue({
			id: 'season-1',
			name: 'Spring 2026',
			slug: 'spring-2026'
		});
		mocks.dbOps.seasons.getCurrentByClientId.mockResolvedValue({
			id: 'season-1',
			name: 'Spring 2026',
			slug: 'spring-2026'
		});
		mocks.dbOps.offerings.getByClientId.mockResolvedValue([
			{ id: 'off-1', name: 'Basketball', slug: 'basketball', seasonId: 'season-1' }
		]);
		mocks.dbOps.leagues.getByClientId.mockResolvedValue([
			{
				id: 'league-1',
				name: "Men's Competitive",
				slug: 'mens-competitive',
				offeringId: 'off-1',
				seasonId: 'season-1'
			}
		]);
		mocks.dbOps.divisions.getByLeagueId.mockResolvedValue([
			{
				id: 'div-1',
				name: 'Monday 5:00 PM',
				slug: 'monday-500-pm',
				leagueId: 'league-1',
				dayOfWeek: 'Monday',
				gameTime: '17:00'
			}
		]);
		mocks.dbOps.teams.getByClientIdAndDivisionIds.mockResolvedValue([
			{
				id: 'team-1',
				divisionId: 'div-1',
				name: 'Wildcats',
				slug: 'wildcats',
				teamStatus: 'active',
				doesAcceptFreeAgents: 1,
				isAutoAcceptMembers: 0,
				currentRosterSize: 7,
				teamColor: 'Blue',
				dateRegistered: '2026-02-01T10:00:00.000Z',
				dateJoinedDivision: '2026-02-02T10:00:00.000Z',
				createdAt: '2026-01-28T10:00:00.000Z'
			},
			{
				id: 'team-2',
				divisionId: 'div-1',
				name: 'Falcons',
				slug: 'falcons',
				teamStatus: 'active',
				doesAcceptFreeAgents: 0,
				isAutoAcceptMembers: 0,
				currentRosterSize: 8,
				teamColor: null,
				dateRegistered: '2026-02-01T10:00:00.000Z',
				dateJoinedDivision: '2026-02-03T10:00:00.000Z',
				createdAt: '2026-01-28T10:00:00.000Z'
			}
		]);
		mocks.dbOps.rosters.getByClientIdAndTeamIds.mockResolvedValue([
			{
				id: 'roster-1',
				teamId: 'team-1',
				userId: 'player-1',
				isCaptain: 1,
				isCoCaptain: 0,
				rosterStatus: 'active',
				dateJoined: '2026-02-01T11:00:00.000Z',
				dateLeft: null,
				createdAt: '2026-02-01T11:00:00.000Z'
			}
		]);
		mocks.dbOps.users.getByClientId.mockResolvedValue([
			{
				id: 'player-1',
				firstName: 'Alex',
				lastName: 'Jordan',
				email: 'alex@playims.test'
			}
		]);
		mocks.dbOps.divisionStandings.getByClientIdAndLeagueId.mockResolvedValue([
			{
				id: 'standing-1',
				divisionId: 'div-1',
				leagueId: 'league-1',
				teamId: 'team-1',
				wins: 3,
				losses: 1,
				ties: 0,
				points: 9,
				winPct: '.750',
				streak: 'W2'
			}
		]);
		mocks.dbOps.events.getByClientId.mockResolvedValue([
			{
				id: 'event-1',
				divisionId: 'div-1',
				homeTeamId: 'team-1',
				awayTeamId: 'team-2',
				scheduledStartAt: '2026-03-01T22:00:00.000Z',
				scheduledEndAt: '2026-03-01T23:00:00.000Z',
				facilityId: 'facility-1',
				facilityAreaId: 'area-1',
				status: 'scheduled',
				weekNumber: 1,
				homeScore: null,
				awayScore: null
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
				facilityId: 'facility-1',
				name: 'Court A'
			}
		]);
	});

	it('returns composed team detail data for a valid nested route', async () => {
		// this proves the route combines roster, standings, and schedule sections that the page depends on.
		const result = (await load(createEvent())) as any;

		expect(result.team?.name).toBe('Wildcats');
		expect(result.team?.dateJoinedDivision).toBe('2026-02-02T10:00:00.000Z');
		expect(result.roster).toHaveLength(1);
		expect(result.roster[0]).toMatchObject({
			displayName: 'Alex Jordan',
			roleLabel: 'Captain'
		});
		expect(result.standings[0]).toMatchObject({
			teamId: 'team-1',
			rank: 1
		});
		expect(result.schedule[0]).toMatchObject({
			opponentName: 'Falcons',
			location: 'Main Gym - Court A',
			status: 'Scheduled'
		});
	});

	it('redirects to offerings when the team slug does not exist in the division', async () => {
		// missing nested slugs should never leak partial data; they should return to the offerings index.
		await expect(load(createEvent({ teamSlug: 'missing-team' }))).rejects.toMatchObject({
			status: 302,
			location: '/dashboard/offerings'
		});
	});
});
