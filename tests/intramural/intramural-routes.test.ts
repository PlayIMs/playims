/*
Brief description:
This file verifies high-value route decisions for intramural offerings, leagues, and seasons.

Deeper explanation:
The intramural routes contain many business rules, including duplicate detection, cross-season linking,
league wording that changes by offering type, season ownership checks, and role-based destructive
permissions. These tests focus on the branches most likely to confuse a future developer or regress
quietly during refactors. The helpers below build realistic route events and payloads so each test can
change one rule at a time while keeping the rest of the route environment stable.

Summary of tests:
1. It verifies that the route suggests the next available offering slug when the requested one is taken.
2. It verifies that linked offerings join an existing cross-season series.
3. It verifies that tournament offerings use group wording in duplicate errors.
4. It verifies that league updates reject seasons outside the selected offering.
5. It verifies that duplicate season creation is blocked before any writes happen.
6. It verifies that the current season cannot be archived without a fallback active season.
7. It verifies that season deletion is restricted to administrator-like roles.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these mocks replace the tenant db helpers used by the intramural route files.
// hoisting matters here for the same reason as the other route tests: the routes import their
// dependencies immediately, so the fakes must exist before those modules are evaluated.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			seasons: {
				getByClientId: vi.fn(),
				create: vi.fn(),
				setCurrent: vi.fn(),
				setActive: vi.fn(),
				getByClientIdAndId: vi.fn(),
				updateDetails: vi.fn()
			},
			offerings: {
				getByClientId: vi.fn(),
				create: vi.fn(),
				updateSeriesId: vi.fn(),
				deleteById: vi.fn()
			},
			leagues: {
				getByClientId: vi.fn(),
				getByOfferingId: vi.fn(),
				create: vi.fn(),
				deleteByOfferingId: vi.fn(),
				getByClientIdAndId: vi.fn(),
				updateByClientIdAndId: vi.fn()
			}
		},
		getTenantDbOps: vi.fn(),
		getTenantD1Database: vi.fn()
	};
});

// this wires every route under test to the same controlled fake database layer.
// each individual test can then shape the fake data to exercise one business rule.
vi.mock('$lib/server/database/context', () => {
	mocks.getTenantDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getTenantDbOps: mocks.getTenantDbOps,
		getTenantD1Database: mocks.getTenantD1Database
	};
});

import { POST as createOffering } from '../../src/routes/api/intramural-sports/offerings/+server';
import {
	PATCH as updateLeague,
	POST as createLeague
} from '../../src/routes/api/intramural-sports/leagues/+server';
import {
	DELETE as deleteSeason,
	PATCH as manageSeason,
	POST as createSeason
} from '../../src/routes/api/intramural-sports/seasons/+server';

// this helper builds the sveltekit event object expected by the route handlers.
// the optional overrides let us simulate different roles, paths, payloads, and platform states
// without repeating the full auth/session scaffolding in every test.
const createRouteEvent = (input?: {
	method?: string;
	path?: string;
	body?: unknown;
	role?: string;
	withDatabase?: boolean;
}) => {
	const path = input?.path ?? '/api/intramural-sports';
	const url = new URL(`https://playims.test${path}`);
	return {
		url,
		request: new Request(url, {
			method: input?.method ?? 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(input?.body ?? {})
		}),
		params: {},
		platform: input?.withDatabase === false ? { env: {} } : { env: { DB: {} } },
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role: input?.role ?? 'admin'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role: input?.role ?? 'admin'
			}
		}
	} as any;
};

// this is the shared valid create-offering payload.
// the helper keeps one known-good baseline so each test can override only the business rule it is
// targeting instead of rebuilding the entire nested request body from scratch.
const createOfferingPayload = (
	overrides?: {
		offering?: Record<string, unknown>;
		leagues?: Array<Record<string, unknown>>;
	}
) => ({
	offering: {
		seasonId: 'season-1',
		name: 'Basketball',
		slug: 'basketball',
		linkedOfferingId: null,
		isActive: true,
		imageUrl: null,
		minPlayers: 5,
		maxPlayers: 10,
		rulebookUrl: null,
		sport: 'Basketball',
		type: 'league',
		description: null,
		...(overrides?.offering ?? {})
	},
	leagues:
		overrides?.leagues ??
		[
			{
				name: 'Open League',
				slug: 'open-league',
				stackOrder: 1,
				description: null,
				seasonId: 'season-1',
				gender: 'mixed',
				skillLevel: 'all',
				regStartDate: '2026-03-01T09:00',
				regEndDate: '2026-03-10T09:00',
				seasonStartDate: '2026-03-20',
				seasonEndDate: '2026-04-20',
				hasPostseason: false,
				postseasonStartDate: null,
				postseasonEndDate: null,
				hasPreseason: false,
				preseasonStartDate: null,
				preseasonEndDate: null,
				isActive: true,
				isLocked: false,
				imageUrl: null
			}
		]
});

// this payload mirrors adding leagues or tournament groups to an existing offering.
// keeping it in one place makes the wording and season checks easier to test consistently.
const createLeaguePayload = (overrides?: Partial<Record<string, unknown>>) => ({
	offeringId: 'offering-1',
	leagues: [
		{
			name: 'Competitive',
			slug: 'competitive',
			stackOrder: 1,
			description: null,
			seasonId: 'season-1',
			gender: 'mixed',
			skillLevel: 'all',
			regStartDate: '2026-03-01T09:00',
			regEndDate: '2026-03-10T09:00',
			seasonStartDate: '2026-03-20',
			seasonEndDate: '2026-04-20',
			hasPostseason: false,
			postseasonStartDate: null,
			postseasonEndDate: null,
			hasPreseason: false,
			preseasonStartDate: null,
			preseasonEndDate: null,
			isActive: true,
			isLocked: false,
			imageUrl: null
		}
	],
	...(overrides ?? {})
});

// this payload is for updating a single league.
// it separates route-event setup from domain-data setup, which makes the test intent easier to read.
const createLeagueUpdatePayload = (
	overrides?: {
		league?: Record<string, unknown>;
		leagueId?: string;
		offeringId?: string;
	}
) => ({
	leagueId: overrides?.leagueId ?? 'league-1',
	offeringId: overrides?.offeringId ?? 'offering-1',
	league: {
		name: 'Competitive',
		slug: 'competitive',
		stackOrder: 3,
		description: null,
		seasonId: 'season-1',
		gender: 'mixed',
		skillLevel: 'all',
		regStartDate: '2026-03-01T09:00',
		regEndDate: '2026-03-10T09:00',
		seasonStartDate: '2026-03-20',
		seasonEndDate: '2026-04-20',
		hasPostseason: false,
		postseasonStartDate: null,
		postseasonEndDate: null,
		hasPreseason: false,
		preseasonStartDate: null,
		preseasonEndDate: null,
		isActive: true,
		isLocked: false,
		imageUrl: null,
		...(overrides?.league ?? {})
	}
});

// this helper builds valid season payloads and only includes optional nested objects when needed.
// that matters because undefined optional objects and present optional objects can trigger different
// route behavior, so the helper preserves that distinction.
const createSeasonPayload = (
	overrides?: {
		season?: Record<string, unknown>;
		currentSeasonTransition?: Record<string, unknown>;
		copyOptions?: Record<string, unknown>;
	}
) => ({
	season: {
		name: 'Spring 2026',
		slug: 'spring-2026',
		startDate: '2026-03-20',
		endDate: '2026-05-01',
		isCurrent: true,
		isActive: true,
		...(overrides?.season ?? {})
	},
	...(overrides?.currentSeasonTransition
		? { currentSeasonTransition: overrides.currentSeasonTransition }
		: {}),
	...(overrides?.copyOptions ? { copyOptions: overrides.copyOptions } : {})
});

describe('intramural routes', () => {
	beforeEach(() => {
		// clear old call history so each test proves its own behavior.
		vi.clearAllMocks();
		// many intramural error paths intentionally log server errors. muting expected logs keeps the
		// test output readable while still letting the route behave naturally.
		vi.spyOn(console, 'error').mockImplementation(() => {});

		// these are the default "healthy" records used by most tests.
		// individual tests override only the one dependency result needed for their scenario.
		mocks.dbOps.seasons.getByClientId.mockResolvedValue([
			{
				id: 'season-1',
				name: 'Spring 2026',
				slug: 'spring-2026',
				startDate: '2026-03-20',
				endDate: '2026-05-01',
				isCurrent: 1,
				isActive: 1
			}
		]);
		mocks.dbOps.seasons.create.mockResolvedValue({
			id: 'season-2',
			name: 'Summer 2026',
			slug: 'summer-2026',
			startDate: '2026-06-01',
			endDate: '2026-07-15',
			isCurrent: 1,
			isActive: 1
		});
		mocks.dbOps.seasons.setCurrent.mockResolvedValue(undefined);
		mocks.dbOps.seasons.setActive.mockResolvedValue(undefined);
		mocks.dbOps.seasons.getByClientIdAndId.mockResolvedValue(null);
		mocks.dbOps.seasons.updateDetails.mockResolvedValue(null);

		mocks.dbOps.offerings.getByClientId.mockResolvedValue([
			{
				id: 'offering-1',
				name: 'Basketball',
				slug: 'basketball',
				seasonId: 'season-1',
				type: 'league',
				isActive: 1
			}
		]);
		mocks.dbOps.offerings.create.mockResolvedValue({
			id: 'offering-2',
			name: 'Basketball',
			type: 'league'
		});
		mocks.dbOps.offerings.updateSeriesId.mockResolvedValue(undefined);
		mocks.dbOps.offerings.deleteById.mockResolvedValue(undefined);

		mocks.dbOps.leagues.getByClientId.mockResolvedValue([]);
		mocks.dbOps.leagues.getByOfferingId.mockResolvedValue([]);
		mocks.dbOps.leagues.create.mockResolvedValue({
			id: 'league-1',
			name: 'Open League',
			stackOrder: 1,
			gender: 'mixed',
			skillLevel: 'all',
			regStartDate: '2026-03-01T09:00',
			regEndDate: '2026-03-10T09:00',
			seasonStartDate: '2026-03-20',
			seasonEndDate: '2026-04-20',
			isLocked: 0,
			isActive: 1
		});
		mocks.dbOps.leagues.deleteByOfferingId.mockResolvedValue(undefined);
		mocks.dbOps.leagues.getByClientIdAndId.mockResolvedValue({
			id: 'league-1',
			name: 'Competitive',
			slug: 'competitive'
		});
		mocks.dbOps.leagues.updateByClientIdAndId.mockResolvedValue({
			id: 'league-1'
		});
	});

	it('suggests the next offering slug when the selected season already uses it', async () => {
		// two existing slugs are provided so the route has to skip both and suggest the next free one.
		// this proves the user gets actionable feedback instead of a vague duplicate error.
		mocks.dbOps.offerings.getByClientId.mockResolvedValue([
			{
				id: 'offering-1',
				name: 'Soccer',
				slug: 'basketball',
				seasonId: 'season-1',
				isActive: 1
			},
			{
				id: 'offering-2',
				name: 'Flag Football',
				slug: 'basketball-1',
				seasonId: 'season-1',
				isActive: 1
			}
		]);

		const response = await createOffering(
			createRouteEvent({
				path: '/api/intramural-sports/offerings',
				body: createOfferingPayload()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.fieldErrors['offering.slug'][0]).toContain('Try "basketball-2".');
		expect(mocks.dbOps.offerings.create).not.toHaveBeenCalled();
	});

	it('links new offerings into an existing cross-season series when a valid linked offering is supplied', async () => {
		// series id starts as null on purpose. this forces the route to create or assign a series id,
		// which is the tricky behavior this test exists to protect.
		mocks.dbOps.offerings.getByClientId.mockResolvedValue([
			{
				id: 'offering-1',
				name: 'Basketball',
				slug: 'basketball',
				seasonId: 'season-0',
				seriesId: null,
				isActive: 1,
				type: 'league'
			}
		]);

		const response = await createOffering(
			createRouteEvent({
				path: '/api/intramural-sports/offerings',
				body: createOfferingPayload({
					offering: {
						linkedOfferingId: 'offering-1'
					}
				})
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(201);
		expect(payload.success).toBe(true);
		// expect any string keeps the test focused on the promise that "some generated series id" is
		// written, without over-coupling the test to the exact random value.
		expect(mocks.dbOps.offerings.updateSeriesId).toHaveBeenCalledWith(
			'client-1',
			'offering-1',
			expect.any(String),
			'user-1'
		);
	});

	it('uses tournament wording when duplicate group slugs are found', async () => {
		// tournament offerings intentionally say "group" instead of "league" in user-facing errors.
		// this test protects that wording so the ui stays consistent with the domain language.
		mocks.dbOps.offerings.getByClientId.mockResolvedValue([
			{
				id: 'offering-1',
				name: 'Basketball',
				slug: 'basketball',
				seasonId: 'season-1',
				type: 'tournament',
				isActive: 1
			}
		]);
		mocks.dbOps.leagues.getByOfferingId.mockResolvedValue([
			{
				id: 'league-1',
				name: 'Competitive',
				slug: 'competitive'
			}
		]);

		const response = await createLeague(
			createRouteEvent({
				path: '/api/intramural-sports/leagues',
				body: createLeaguePayload()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.fieldErrors['leagues.0.slug'][0]).toBe(
			'A group with this slug already exists for the selected offering.'
		);
	});

	it('rejects league updates that target a season outside the selected offering', async () => {
		// the selected offering belongs to season-1, but the update tries to move the league to
		// season-2. that should fail because leagues must stay aligned with the offering's season.
		mocks.dbOps.seasons.getByClientId.mockResolvedValue([
			{
				id: 'season-1',
				name: 'Spring 2026'
			},
			{
				id: 'season-2',
				name: 'Summer 2026'
			}
		]);

		const response = await updateLeague(
			createRouteEvent({
				method: 'PATCH',
				path: '/api/intramural-sports/leagues',
				body: createLeagueUpdatePayload({
					league: {
						seasonId: 'season-2'
					}
				})
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.fieldErrors['league.seasonId'][0]).toBe(
			'League/group season must match the selected offering season.'
		);
		expect(mocks.dbOps.leagues.updateByClientIdAndId).not.toHaveBeenCalled();
	});

	it('blocks duplicate season creation before any writes happen', async () => {
		// duplicate checks should happen before create calls. this test exists so a future refactor
		// does not accidentally write partial data before discovering the collision.
		mocks.dbOps.seasons.getByClientId.mockResolvedValue([
			{
				id: 'season-1',
				name: 'Spring 2026',
				slug: 'spring-2026',
				isCurrent: 1,
				isActive: 1
			}
		]);

		const response = await createSeason(
			createRouteEvent({
				path: '/api/intramural-sports/seasons',
				body: createSeasonPayload()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('Duplicate season detected.');
		expect(mocks.dbOps.seasons.create).not.toHaveBeenCalled();
	});

	it('prevents archiving the current season when there is no fallback active season', async () => {
		// this protects a workflow rule, not just a status code: the app must always have a usable
		// active season to fall back to before the current one can be deactivated.
		const response = await manageSeason(
			createRouteEvent({
				method: 'PATCH',
				path: '/api/intramural-sports/seasons',
				body: {
					action: 'set-active',
					seasonId: 'season-1',
					isActive: false
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe(
			'Cannot archive or deactivate the current season because no fallback active season exists.'
		);
		expect(mocks.dbOps.seasons.setActive).not.toHaveBeenCalled();
	});

	it('restricts season deletion to administrators and developers', async () => {
		// destructive operations use role checks at the route level. this test proves a manager cannot
		// bypass that rule just by sending a direct api request.
		const response = await deleteSeason(
			createRouteEvent({
				method: 'DELETE',
				path: '/api/intramural-sports/seasons',
				role: 'manager',
				body: {
					seasonId: 'season-1',
					confirmSlug: 'spring-2026',
					reason: null
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.error).toBe('Only administrators and developers can delete seasons.');
	});
});
