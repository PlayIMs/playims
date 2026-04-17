/*
Brief description:
This file verifies the server load behavior for the main dashboard home page.

Deeper explanation:
The dashboard home page now turns recent activity into linked team-registration updates. These tests
protect the data contract that the Svelte page depends on, so each sentence fragment can stay
clickable and continue pointing at the correct dashboard destination when the load logic evolves.

Summary of tests:
1. It verifies that recent team registrations return structured creator, team, league, offering, and division links.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireAuthenticatedClientId: vi.fn(),
	getCentralDbOps: vi.fn(),
	getTenantDbOps: vi.fn(),
	centralDb: {
		users: {
			getByClientId: vi.fn(),
			getAuthById: vi.fn()
		},
		userClients: {
			getMembership: vi.fn()
		}
	},
	tenantDb: {
		events: {
			getByClientId: vi.fn()
		},
		teams: {
			getByClientId: vi.fn()
		},
		leagues: {
			getByClientId: vi.fn()
		},
		offerings: {
			getByClientId: vi.fn()
		},
		facilities: {
			getAll: vi.fn()
		},
		announcements: {
			getAll: vi.fn()
		},
		rosters: {
			getByClientId: vi.fn()
		},
		seasons: {
			getCurrentByClientId: vi.fn(),
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
	getCentralDbOps: mocks.getCentralDbOps,
	getTenantDbOps: mocks.getTenantDbOps
}));

import { load } from '../../src/routes/dashboard/+page.server';

type DashboardPageLoadData = Exclude<Awaited<ReturnType<typeof load>>, void>;

// this helper keeps the authenticated dashboard event compact for the assertions below.
const buildEvent = () =>
	({
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

describe('dashboard home page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.requireAuthenticatedClientId.mockReturnValue('client-1');
		mocks.getCentralDbOps.mockReturnValue(mocks.centralDb);
		mocks.getTenantDbOps.mockResolvedValue(mocks.tenantDb);

		mocks.centralDb.users.getByClientId.mockResolvedValue([
			{
				id: 'user-1',
				firstName: 'Jake',
				lastName: 'Harvanchik',
				email: 'jake@playims.test',
				status: 'active'
			}
		]);
		mocks.centralDb.users.getAuthById.mockResolvedValue({
			id: 'user-1',
			firstName: 'Jake',
			lastName: 'Harvanchik',
			email: 'jake@playims.test',
			status: 'active'
		});
		mocks.centralDb.userClients.getMembership.mockResolvedValue({
			id: 'membership-1',
			userId: 'user-1',
			clientId: 'client-1',
			status: 'active'
		});

		mocks.tenantDb.events.getByClientId.mockResolvedValue([]);
		mocks.tenantDb.teams.getByClientId.mockResolvedValue([
			{
				id: 'team-1',
				clientId: 'client-1',
				divisionId: 'division-1',
				name: 'Ballers to Wallers',
				slug: 'ballers-to-wallers',
				teamStatus: 'active',
				dateRegistered: '2026-04-10T15:00:00.000Z',
				createdAt: '2026-04-10T15:00:00.000Z',
				updatedAt: '2026-04-10T15:00:00.000Z',
				createdUser: 'user-1',
				updatedUser: 'user-1'
			}
		]);
		mocks.tenantDb.leagues.getByClientId.mockResolvedValue([
			{
				id: 'league-1',
				clientId: 'client-1',
				offeringId: 'offering-1',
				seasonId: 'season-1',
				name: "Men's Competitive",
				slug: 'mens-competitive',
				isActive: 1
			}
		]);
		mocks.tenantDb.offerings.getByClientId.mockResolvedValue([
			{
				id: 'offering-1',
				clientId: 'client-1',
				seasonId: 'season-1',
				name: 'Basketball',
				slug: 'basketball',
				isActive: 1
			}
		]);
		mocks.tenantDb.facilities.getAll.mockResolvedValue([]);
		mocks.tenantDb.announcements.getAll.mockResolvedValue([]);
		mocks.tenantDb.rosters.getByClientId.mockResolvedValue([]);
		mocks.tenantDb.seasons.getCurrentByClientId.mockResolvedValue({
			id: 'season-1',
			name: 'Spring 2026',
			slug: 'spring-2026',
			startDate: '2026-01-15',
			endDate: '2026-05-01'
		});
		mocks.tenantDb.seasons.getByClientId.mockResolvedValue([
			{
				id: 'season-1',
				clientId: 'client-1',
				name: 'Spring 2026',
				slug: 'spring-2026',
				startDate: '2026-01-15',
				endDate: '2026-05-01',
				isCurrent: 1,
				isActive: 1
			}
		]);
		mocks.tenantDb.divisions.getByLeagueIds.mockResolvedValue([
			{
				id: 'division-1',
				leagueId: 'league-1',
				name: 'Monday 3 PM',
				slug: 'monday-3-pm',
				isActive: 1
			}
		]);
	});

	it('returns linked recent activity for team registrations', async () => {
		// the dashboard sentence renderer depends on this structured payload instead of one flat message string.
		const result = (await load(buildEvent())) as DashboardPageLoadData;

		expect(result.recentActivity).toHaveLength(1);
		expect(result.recentActivity[0]).toMatchObject({
			type: 'team_registered',
			timeValue: '2026-04-10T15:00:00.000Z',
			creator: {
				label: 'Jake Harvanchik',
				href: '/dashboard/members?memberId=membership-1&q=Jake+Harvanchik'
			},
			team: {
				label: 'Ballers to Wallers',
				href: '/dashboard/offerings/spring-2026/basketball/mens-competitive/monday-3-pm/ballers-to-wallers'
			},
			league: {
				label: "Men's Competitive",
				href: '/dashboard/offerings/spring-2026/basketball/mens-competitive'
			},
			offering: {
				label: 'Basketball',
				href: '/dashboard/offerings/spring-2026/basketball'
			},
			division: {
				label: 'Monday 3 PM',
				href: '/dashboard/offerings/spring-2026/basketball/mens-competitive/monday-3-pm'
			}
		});
		expect(result.recentActivity[0].time).toEqual(expect.any(String));
	});
});
