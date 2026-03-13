/*
Brief description:
This file verifies the route that manages intramural league divisions and teams from the league management page.

Deeper explanation:
This route contains some of the highest-risk intramural mutation logic in the app. It creates and updates
divisions, blocks invalid team placement into locked or full divisions, moves teams across divisions,
deletes teams, clears standings, and recomputes division team counts. These tests focus on the branches
most likely to let bad league state slip through during future refactors.

Summary of tests:
1. It verifies that creating a division rejects duplicate slugs within the same league.
2. It verifies that updating a missing division returns a not-found response.
3. It verifies that active teams cannot be added directly into locked divisions.
4. It verifies that active teams cannot be added into full divisions.
5. It verifies that moving a team into a full division is rejected.
6. It verifies that removing a team also clears dependent records and resyncs division counts.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks make sure the route imports a fake tenant database helper during module load.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			seasons: {
				getByClientIdAndSlug: vi.fn()
			},
			leagues: {
				getByClientIdAndId: vi.fn(),
				getByClientIdSeasonIdAndSlug: vi.fn(),
				getByClientId: vi.fn()
			},
			divisions: {
				getByLeagueId: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				updateTeamsCount: vi.fn()
			},
			teams: {
				getByClientIdAndSlug: vi.fn(),
				getByClientIdAndDivisionIds: vi.fn(),
				create: vi.fn(),
				updatePlacement: vi.fn(),
				deleteByClientIdAndId: vi.fn()
			},
			rosters: {
				deleteByClientIdAndTeamId: vi.fn()
			},
			divisionStandings: {
				deleteByClientIdAndTeamId: vi.fn()
			}
		},
		getTenantDbOps: vi.fn()
	};
});

// the route remains real, but all database reads and writes are driven by the fixtures below.
vi.mock('$lib/server/database/context', () => {
	mocks.getTenantDbOps.mockImplementation(() => Promise.resolve(mocks.dbOps));
	return {
		getTenantDbOps: mocks.getTenantDbOps
	};
});

import {
	DELETE,
	PATCH,
	POST
} from '../../src/routes/api/intramural-sports/leagues/[seasonSlug]/[leagueSlug]/management/+server';

const CLIENT_ID = 'client-1';
const LEAGUE_ID = 'league-1';
const SEASON_SLUG = 'spring-2026';
const LEAGUE_SLUG = 'competitive';

const divisionFixture = (overrides?: Record<string, unknown>) => ({
	id: 'division-a',
	name: 'Open',
	slug: 'open',
	maxTeams: 6,
	isLocked: 0,
	...overrides
});

const createDivisionBody = (overrides?: {
	leagueId?: string;
	divisionId?: string;
	division?: Record<string, unknown>;
}) => ({
	action: 'create-division',
	leagueId: overrides?.leagueId ?? LEAGUE_ID,
	division: {
		name: 'Premier Division',
		slug: 'premier-division',
		description: null,
		dayOfWeek: null,
		gameTime: null,
		maxTeams: 8,
		location: null,
		isLocked: false,
		startDate: null,
		...(overrides?.division ?? {})
	}
});

const updateDivisionBody = (overrides?: {
	leagueId?: string;
	divisionId?: string;
	division?: Record<string, unknown>;
}) => ({
	action: 'update-division',
	leagueId: overrides?.leagueId ?? LEAGUE_ID,
	divisionId: overrides?.divisionId ?? 'division-a',
	division: {
		name: 'Premier Division',
		slug: 'premier-division',
		description: null,
		dayOfWeek: null,
		gameTime: null,
		maxTeams: 8,
		location: null,
		isLocked: false,
		startDate: null,
		...(overrides?.division ?? {})
	}
});

const createTeamBody = (overrides?: {
	leagueId?: string;
	team?: Record<string, unknown>;
}) => ({
	action: 'create-team',
	leagueId: overrides?.leagueId ?? LEAGUE_ID,
	team: {
		divisionId: 'division-a',
		name: 'Team One',
		slug: 'team-one',
		description: null,
		imageUrl: null,
		teamColor: null,
		placement: 'active',
		...(overrides?.team ?? {})
	}
});

const moveTeamBody = (overrides?: Record<string, unknown>) => ({
	action: 'move-team',
	leagueId: LEAGUE_ID,
	teamId: 'team-1',
	divisionId: 'division-b',
	placement: 'active',
	...(overrides ?? {})
});

const removeTeamBody = (overrides?: Record<string, unknown>) => ({
	action: 'remove-team',
	leagueId: LEAGUE_ID,
	teamId: 'team-1',
	...(overrides ?? {})
});

// this helper builds the authenticated event shape expected by the management route.
const createEvent = (input: {
	method: 'POST' | 'PATCH' | 'DELETE';
	body: unknown;
	role?: string;
}) => {
	const url = new URL(
		`https://playims.test/api/intramural-sports/leagues/${SEASON_SLUG}/${LEAGUE_SLUG}/management`
	);
	return {
		url,
		request: new Request(url, {
			method: input.method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(input.body)
		}),
		params: {
			seasonSlug: SEASON_SLUG,
			leagueSlug: LEAGUE_SLUG
		},
		platform: { env: { DB: {} } },
		locals: {
			user: {
				id: 'user-1',
				clientId: CLIENT_ID,
				role: input.role ?? 'admin'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: CLIENT_ID,
				activeClientId: CLIENT_ID,
				role: input.role ?? 'admin'
			}
		}
	} as any;
};

describe('league management route', () => {
	beforeEach(() => {
		// these defaults keep the route on a clean happy-path baseline unless a test overrides one branch.
		vi.clearAllMocks();
		mocks.dbOps.seasons.getByClientIdAndSlug.mockResolvedValue({
			id: 'season-1',
			name: 'Spring 2026',
			slug: SEASON_SLUG
		});
		mocks.dbOps.leagues.getByClientIdAndId.mockResolvedValue({
			id: LEAGUE_ID,
			slug: LEAGUE_SLUG,
			seasonId: 'season-1'
		});
		mocks.dbOps.leagues.getByClientIdSeasonIdAndSlug.mockResolvedValue(null);
		mocks.dbOps.leagues.getByClientId.mockResolvedValue([]);
		mocks.dbOps.divisions.getByLeagueId.mockResolvedValue([
			divisionFixture(),
			divisionFixture({
				id: 'division-b',
				name: 'Elite',
				slug: 'elite',
				maxTeams: 1,
				isLocked: 0
			})
		]);
		mocks.dbOps.divisions.create.mockResolvedValue({
			id: 'division-new'
		});
		mocks.dbOps.divisions.update.mockResolvedValue({
			id: 'division-a'
		});
		mocks.dbOps.divisions.updateTeamsCount.mockResolvedValue(undefined);
		mocks.dbOps.teams.getByClientIdAndSlug.mockResolvedValue(null);
		mocks.dbOps.teams.getByClientIdAndDivisionIds.mockResolvedValue([]);
		mocks.dbOps.teams.create.mockResolvedValue({
			id: 'team-created',
			teamStatus: 'active'
		});
		mocks.dbOps.teams.updatePlacement.mockResolvedValue({
			id: 'team-1'
		});
		mocks.dbOps.teams.deleteByClientIdAndId.mockResolvedValue({ id: 'team-1' });
		mocks.dbOps.rosters.deleteByClientIdAndTeamId.mockResolvedValue(undefined);
		mocks.dbOps.divisionStandings.deleteByClientIdAndTeamId.mockResolvedValue(undefined);
	});

	it('rejects duplicate division slugs when creating a division', async () => {
		// duplicate division slugs would break management lookups and page routes inside the same league.
		const response = await POST(
			createEvent({
				method: 'POST',
				body: createDivisionBody({
					division: {
						slug: 'open'
					}
				})
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('Duplicate division detected.');
		expect(payload.fieldErrors['division.slug']).toEqual([
			'A division with this slug already exists for this league.'
		]);
		expect(mocks.dbOps.divisions.create).not.toHaveBeenCalled();
	});

	it('returns 404 when updating a division that is not in the selected league', async () => {
		// this prevents stale ids from silently updating the wrong division record.
		const response = await POST(
			createEvent({
				method: 'POST',
				body: updateDivisionBody({
					divisionId: 'missing-division'
				})
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(404);
		expect(payload.error).toBe('Division not found.');
		expect(mocks.dbOps.divisions.update).not.toHaveBeenCalled();
	});

	it('blocks active team creation in locked divisions', async () => {
		// locked divisions should only accept teams onto the waitlist, not directly into active play.
		mocks.dbOps.divisions.getByLeagueId.mockResolvedValue([
			divisionFixture({
				id: 'division-a',
				isLocked: 1
			})
		]);

		const response = await POST(
			createEvent({
				method: 'POST',
				body: createTeamBody()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('Selected division is locked.');
		expect(payload.fieldErrors['team.divisionId']).toEqual([
			'This division is locked. Add the team to the waitlist instead.'
		]);
		expect(mocks.dbOps.teams.create).not.toHaveBeenCalled();
	});

	it('blocks active team creation when the selected division is already full', async () => {
		// max-team enforcement is an easy rule to lose during refactors because it depends on pooled team state.
		mocks.dbOps.divisions.getByLeagueId.mockResolvedValue([
			divisionFixture({
				id: 'division-a',
				maxTeams: 1,
				isLocked: 0
			})
		]);
		mocks.dbOps.teams.getByClientIdAndDivisionIds.mockResolvedValue([
			{
				id: 'team-existing',
				divisionId: 'division-a',
				teamStatus: 'active'
			}
		]);

		const response = await POST(
			createEvent({
				method: 'POST',
				body: createTeamBody()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('Selected division is full.');
		expect(payload.fieldErrors['team.divisionId']).toEqual([
			'This division is already at capacity. Add the team to the waitlist instead.'
		]);
		expect(mocks.dbOps.teams.create).not.toHaveBeenCalled();
	});

	it('rejects moving a team into a full target division', async () => {
		// this protects live league state from overfilling a division through drag-and-drop or admin moves.
		mocks.dbOps.teams.getByClientIdAndDivisionIds.mockResolvedValue([
			{
				id: 'team-1',
				divisionId: 'division-a',
				teamStatus: 'active'
			},
			{
				id: 'team-2',
				divisionId: 'division-b',
				teamStatus: 'active'
			}
		]);

		const response = await PATCH(
			createEvent({
				method: 'PATCH',
				body: moveTeamBody()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('Selected division is full.');
		expect(payload.fieldErrors.divisionId).toEqual(['This division is already at capacity.']);
		expect(mocks.dbOps.teams.updatePlacement).not.toHaveBeenCalled();
	});

	it('removes a team and resyncs division counts after cleanup', async () => {
		// this is the success path that proves roster cleanup, standings cleanup, deletion, and count sync stay coupled.
		mocks.dbOps.teams.getByClientIdAndDivisionIds
			.mockResolvedValueOnce([
				{
					id: 'team-1',
					divisionId: 'division-a',
					teamStatus: 'active'
				}
			])
			.mockResolvedValueOnce([]);

		const response = await DELETE(
			createEvent({
				method: 'DELETE',
				body: removeTeamBody()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			data: {
				leagueId: LEAGUE_ID,
				teamId: 'team-1'
			}
		});
		expect(mocks.dbOps.rosters.deleteByClientIdAndTeamId).toHaveBeenCalledWith(CLIENT_ID, 'team-1');
		expect(mocks.dbOps.divisionStandings.deleteByClientIdAndTeamId).toHaveBeenCalledWith(
			CLIENT_ID,
			'team-1'
		);
		expect(mocks.dbOps.teams.deleteByClientIdAndId).toHaveBeenCalledWith(CLIENT_ID, 'team-1');
		expect(mocks.dbOps.divisions.updateTeamsCount).toHaveBeenCalledWith('division-a', 0, 'user-1');
	});
});
