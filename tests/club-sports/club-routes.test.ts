/*
Brief description:
This file verifies high-value route decisions for club sports seasons, clubs, leagues, officers, and teams.

Deeper explanation:
Club sports add a second competition domain beside intramurals, so the route layer has to enforce its own
permissions, duplicate rules, season rollover defaults, officer-title rules, and division-free team behavior.
These tests cover the business branches most likely to regress quietly when the new domain evolves.

Summary of tests:
1. It verifies that club season creation defaults rollover selection to clubs, leagues, and teams only.
2. It verifies that duplicate club names in the same club season are rejected before writes happen.
3. It verifies that club leagues can create teams through the management route without divisions.
4. It verifies that organization-managed officer titles cannot be edited through the club endpoint.
5. It verifies that officer assignments allow multiple roles for the same member.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		requireAuthenticatedClientId: vi.fn(),
		requireAuthenticatedUserId: vi.fn(),
		requirePermission: vi.fn(),
		getTenantDbOps: vi.fn(),
		dbOps: {
			clubSportsSeasons: {
				getByClientId: vi.fn(),
				create: vi.fn(),
				setCurrent: vi.fn(),
				updateDetails: vi.fn()
			},
			clubSportsClubs: {
				getByClientId: vi.fn(),
				create: vi.fn(),
				updateByClientIdAndId: vi.fn(),
				getByClientIdAndId: vi.fn()
			},
			clubSportsLeagues: {
				getByClubId: vi.fn(),
				getByClientIdAndId: vi.fn(),
				create: vi.fn()
			},
			clubSportsTeams: {
				getByLeagueId: vi.fn(),
				create: vi.fn()
			},
			clubSportsOfficerTitles: {
				getByClientId: vi.fn(),
				getByClientIdAndId: vi.fn(),
				create: vi.fn(),
				updateByClientIdAndId: vi.fn()
			},
			clubSportsOfficerAssignments: {
				getByClientId: vi.fn(),
				create: vi.fn()
			}
		},
		resolveClubSeasonForParams: vi.fn(),
		resolveClubLeagueForParams: vi.fn()
	};
});

vi.mock('$lib/server/client-context', () => ({
	requireAuthenticatedClientId: mocks.requireAuthenticatedClientId,
	requireAuthenticatedUserId: mocks.requireAuthenticatedUserId
}));

vi.mock('$lib/server/auth/permissions', async () => {
	const actual = await vi.importActual<typeof import('../../src/lib/server/auth/permissions')>(
		'../../src/lib/server/auth/permissions'
	);
	return {
		...actual,
		requirePermission: mocks.requirePermission
	};
});

vi.mock('$lib/server/database/context', () => ({
	getTenantDbOps: mocks.getTenantDbOps
}));

vi.mock('$lib/server/club-sports-scope', async () => {
	const actual = await vi.importActual<typeof import('../../src/lib/server/club-sports-scope')>(
		'../../src/lib/server/club-sports-scope'
	);
	return {
		...actual,
		resolveClubSeasonForParams: mocks.resolveClubSeasonForParams,
		resolveClubLeagueForParams: mocks.resolveClubLeagueForParams
	};
});

import { POST as createClubSeason } from '../../src/routes/api/club-sports/seasons/+server';
import { PATCH as updateClub } from '../../src/routes/api/club-sports/clubs/+server';
import { POST as manageClubLeague } from '../../src/routes/api/club-sports/leagues/[seasonSlug]/[leagueSlug]/management/+server';
import { PATCH as updateOfficerTitle } from '../../src/routes/api/club-sports/officer-titles/+server';
import { POST as assignOfficerRole } from '../../src/routes/api/club-sports/officer-assignments/+server';

const createRouteEvent = (input?: {
	method?: string;
	path?: string;
	body?: unknown;
	withDatabase?: boolean;
}) =>
	({
		url: new URL(`https://playims.test${input?.path ?? '/api/club-sports'}`),
		request: new Request(`https://playims.test${input?.path ?? '/api/club-sports'}`, {
			method: input?.method ?? 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify(input?.body ?? {})
		}),
		params: {
			seasonSlug: '2026-2027',
			leagueSlug: 'mens-league'
		},
		platform: input?.withDatabase === false ? { env: {} } : { env: { DB: {} } },
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

describe('club sports routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireAuthenticatedClientId.mockReturnValue('client-1');
		mocks.requireAuthenticatedUserId.mockReturnValue('user-1');
		mocks.requirePermission.mockReturnValue(true);
		mocks.getTenantDbOps.mockResolvedValue(mocks.dbOps);
	});

	it('defaults club season rollover selection to clubs, leagues, and teams', async () => {
		// this protects the yearly reset default so rosters, schedules, and officers do not copy unless chosen.
		mocks.dbOps.clubSportsSeasons.getByClientId.mockResolvedValue([]);
		mocks.dbOps.clubSportsSeasons.create.mockResolvedValue({
			id: 'season-1',
			name: '2026-2027',
			slug: '2026-2027',
			startDate: '2026-08-01',
			endDate: '2027-05-31',
			isCurrent: 1,
			isActive: 1
		});

		const response = await createClubSeason(
			createRouteEvent({
				path: '/api/club-sports/seasons',
				body: {
					season: {
						name: '2026-2027',
						slug: '2026-2027',
						startDate: '2026-08-01',
						endDate: '2027-05-31',
						isCurrent: true,
						isActive: true
					},
					copy: {
						enabled: true,
						sourceSeasonIds: ['season-old']
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.copy.selection).toEqual({
			includeClubs: true,
			includeLeagues: true,
			includeTeams: true,
			includeOfficers: false,
			includeRosters: false,
			includeSchedules: false
		});
	});

	it('rejects duplicate club names within the same club season', async () => {
		// this prevents sibling clubs from colliding in the same yearly season namespace.
		mocks.dbOps.clubSportsClubs.getByClientId.mockResolvedValue([
			{
				id: 'club-1',
				clubSeasonId: 'season-1',
				name: 'Ice Hockey',
				slug: 'ice-hockey'
			}
		]);

		const response = await updateClub(
			createRouteEvent({
				method: 'PATCH',
				path: '/api/club-sports/clubs',
				body: {
					clubId: 'club-2',
					club: {
						clubSeasonId: 'season-1',
						name: 'Ice Hockey',
						slug: 'ice-hockey',
						description: null,
						sport: 'Ice Hockey',
						imageUrl: null,
						isActive: true
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.success).toBe(false);
		expect(payload.fieldErrors['club.name'][0]).toContain('already exists');
	});

	it('creates club teams through the league management route without divisions', async () => {
		// this locks in the direct league-to-team relationship that separates clubs from intramurals.
		mocks.resolveClubSeasonForParams.mockResolvedValue({
			id: 'season-1',
			name: '2026-2027',
			slug: '2026-2027'
		});
		mocks.resolveClubLeagueForParams.mockResolvedValue({
			club: {
				id: 'club-1',
				clubSeasonId: 'season-1',
				name: 'Ice Hockey',
				slug: 'ice-hockey'
			},
			league: {
				id: 'league-1',
				clubId: 'club-1',
				clubSeasonId: 'season-1',
				name: "Men's League",
				slug: 'mens-league'
			}
		});
		mocks.dbOps.clubSportsTeams.getByLeagueId.mockResolvedValue([]);
		mocks.dbOps.clubSportsTeams.create.mockResolvedValue({
			id: 'team-1',
			name: 'D1 Team',
			slug: 'd1-team'
		});

		const response = await manageClubLeague(
			createRouteEvent({
				path: '/api/club-sports/leagues/2026-2027/mens-league/management',
				body: {
					team: {
						name: 'D1 Team',
						slug: 'd1-team',
						description: null,
						teamColor: 'Blue',
						isActive: true
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.team.id).toBe('team-1');
	});

	it('blocks editing organization-managed officer titles from the club endpoint', async () => {
		// this preserves the org-controlled title catalog even when clubs can add their own extra roles.
		mocks.dbOps.clubSportsOfficerTitles.getByClientIdAndId.mockResolvedValue({
			id: 'title-1',
			name: 'President',
			isOrgManaged: 1,
			isBuiltIn: 1
		});

		const response = await updateOfficerTitle(
			createRouteEvent({
				method: 'PATCH',
				path: '/api/club-sports/officer-titles',
				body: {
					titleId: 'title-1',
					title: {
						name: 'Club President',
						slug: 'club-president',
						scope: 'club',
						isActive: true
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.success).toBe(false);
		expect(payload.error).toContain('organization-managed');
	});

	it('allows multiple officer assignments for the same member', async () => {
		// this keeps captain and leadership roles composable across the same club season.
		mocks.dbOps.clubSportsOfficerTitles.getByClientId.mockResolvedValue([
			{ id: 'title-1', name: 'President', scope: 'club', isActive: 1 },
			{ id: 'title-2', name: 'Captain', scope: 'team', isActive: 1 }
		]);
		mocks.dbOps.clubSportsOfficerAssignments.getByClientId.mockResolvedValue([
			{
				id: 'assignment-1',
				titleId: 'title-1',
				userId: 'member-1',
				clubId: 'club-1',
				clubTeamId: null
			}
		]);
		mocks.dbOps.clubSportsOfficerAssignments.create.mockResolvedValue({
			id: 'assignment-2',
			titleId: 'title-2',
			userId: 'member-1'
		});

		const response = await assignOfficerRole(
			createRouteEvent({
				path: '/api/club-sports/officer-assignments',
				body: {
					assignment: {
						titleId: 'title-2',
						userId: 'member-1',
						clubSeasonId: 'season-1',
						clubId: 'club-1',
						clubTeamId: 'team-1'
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.assignment.id).toBe('assignment-2');
	});
});
