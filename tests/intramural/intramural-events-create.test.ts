/*
Brief description:
This file verifies the secure API route that creates intramural schedule events.

Deeper explanation:
Creating an event is a high-trust mutation because the request carries several related ids that a
malicious client could try to forge across seasons, offerings, leagues, divisions, teams, or
facilities. These tests protect the route contract by checking permission gates, validation, parent
child hierarchy enforcement, and the final database write shape used to create a schedule-ready game.

Summary of tests:
1. It verifies the route fails early when the D1 binding is missing.
2. It verifies participants without offering-management permission are rejected.
3. It verifies invalid payloads return field-level validation errors.
4. It verifies forged hierarchy combinations are rejected before any event write occurs.
5. It verifies valid requests create an event and return the mapped schedule record for immediate UI updates.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	dbOps: {
		seasons: {
			getByClientIdAndId: vi.fn()
		},
		offerings: {
			getByClientIdAndId: vi.fn()
		},
		leagues: {
			getByClientIdAndId: vi.fn()
		},
		divisions: {
			getById: vi.fn()
		},
		teams: {
			getByClientIdAndDivisionIds: vi.fn()
		},
		facilities: {
			getByClientIdAndId: vi.fn()
		},
		facilityAreas: {
			getByClientIdAndId: vi.fn()
		},
		events: {
			create: vi.fn()
		}
	},
	getTenantDbOps: vi.fn()
}));

vi.mock('$lib/server/database/context', () => {
	mocks.getTenantDbOps.mockImplementation(() => Promise.resolve(mocks.dbOps));
	return {
		getTenantDbOps: mocks.getTenantDbOps
	};
});

import { POST } from '../../src/routes/api/intramural-sports/events/+server';

const createPayload = () => ({
	event: {
		seasonId: 'season-1',
		offeringId: 'offering-1',
		leagueId: 'league-1',
		divisionId: 'division-1',
		homeTeamId: 'team-1',
		awayTeamId: 'team-2',
		scheduledStartAt: '2026-04-18T18:00',
		scheduledEndAt: '2026-04-18T19:00',
		facilityId: 'facility-1',
		facilityAreaId: 'area-1',
		weekNumber: 4,
		roundLabel: 'Regular Season',
		notes: 'Bring dark jerseys.',
		isPostseason: false
	}
});

const createEvent = (input?: {
	role?: string;
	withDatabase?: boolean;
	body?: unknown;
	request?: Request;
}) => {
	const url = new URL('https://playims.test/api/intramural-sports/events');
	return {
		url,
		request:
			input?.request ??
			new Request(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(input?.body ?? createPayload())
			}),
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

describe('intramural events create route', () => {
	beforeEach(() => {
		// each test starts from the same trusted hierarchy so individual branches stay easy to reason about.
		vi.clearAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});

		mocks.dbOps.seasons.getByClientIdAndId.mockResolvedValue({
			id: 'season-1',
			name: 'Spring 2026'
		});
		mocks.dbOps.offerings.getByClientIdAndId.mockResolvedValue({
			id: 'offering-1',
			seasonId: 'season-1',
			name: 'Basketball'
		});
		mocks.dbOps.leagues.getByClientIdAndId.mockResolvedValue({
			id: 'league-1',
			offeringId: 'offering-1',
			seasonId: 'season-1',
			name: "Men's Competitive"
		});
		mocks.dbOps.divisions.getById.mockResolvedValue({
			id: 'division-1',
			leagueId: 'league-1',
			name: 'Monday 6 PM'
		});
		mocks.dbOps.teams.getByClientIdAndDivisionIds.mockResolvedValue([
			{
				id: 'team-1',
				divisionId: 'division-1',
				name: 'Wildcats',
				isActive: 1
			},
			{
				id: 'team-2',
				divisionId: 'division-1',
				name: 'Falcons',
				isActive: 1
			}
		]);
		mocks.dbOps.facilities.getByClientIdAndId.mockResolvedValue({
			id: 'facility-1',
			name: 'Main Gym',
			isActive: 1
		});
		mocks.dbOps.facilityAreas.getByClientIdAndId.mockResolvedValue({
			id: 'area-1',
			facilityId: 'facility-1',
			name: 'Court A',
			isActive: 1
		});
		mocks.dbOps.events.create.mockResolvedValue({
			id: 'event-1',
			type: 'game',
			status: 'scheduled',
			scheduledStartAt: '2026-04-18T18:00:00.000Z',
			scheduledEndAt: '2026-04-18T19:00:00.000Z',
			offeringId: 'offering-1',
			leagueId: 'league-1',
			divisionId: 'division-1',
			homeTeamId: 'team-1',
			awayTeamId: 'team-2',
			facilityId: 'facility-1',
			facilityAreaId: 'area-1',
			weekNumber: 4,
			roundLabel: 'Regular Season',
			notes: 'Bring dark jerseys.',
			isPostseason: 0,
			homeScore: null,
			awayScore: null
		});
	});

	it('fails fast when the D1 binding is unavailable', async () => {
		// this keeps the route from pretending a save worked when the platform binding is missing.
		const response = await POST(createEvent({ withDatabase: false }));
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(payload.error).toBe('Unable to save event right now.');
	});

	it('rejects callers without offering management permission', async () => {
		// the route must enforce its own mutation permission because ui affordances alone are not security.
		const response = await POST(createEvent({ role: 'participant' }));
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.error).toBe(
			'Only managers, administrators, and developers can create schedule events.'
		);
		expect(mocks.dbOps.events.create).not.toHaveBeenCalled();
	});

	it('returns validation errors for invalid request bodies', async () => {
		// field-level errors let the wizard explain exactly what the user needs to fix without server guesswork.
		const response = await POST(
			createEvent({
				body: {
					event: {
						...createPayload().event,
						awayTeamId: 'team-1'
					}
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe('Invalid request payload.');
		expect(payload.fieldErrors['event.awayTeamId']).toContain(
			'Home and away teams must be different.'
		);
		expect(mocks.dbOps.events.create).not.toHaveBeenCalled();
	});

	it('rejects mismatched hierarchy ids before writing the event', async () => {
		// this is the core anti-forgery check: the route must prove the selected records belong to the same tree.
		mocks.dbOps.leagues.getByClientIdAndId.mockResolvedValueOnce({
			id: 'league-1',
			offeringId: 'offering-other',
			seasonId: 'season-1',
			name: "Men's Competitive"
		});

		const response = await POST(createEvent());
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe(
			'Selected event details do not belong to the same intramural structure.'
		);
		expect(payload.fieldErrors['event.leagueId']).toContain(
			'Choose a league that belongs to the selected offering.'
		);
		expect(mocks.dbOps.events.create).not.toHaveBeenCalled();
	});

	it('creates an intramural event and returns a schedule-ready record on success', async () => {
		// returning the mapped schedule shape lets the page update instantly instead of reloading and re-deriving names.
		const response = await POST(createEvent());
		const payload = await response.json();

		expect(response.status).toBe(201);
		expect(payload.success).toBe(true);
		expect(payload.data.event).toMatchObject({
			id: 'event-1',
			seasonId: 'season-1',
			seasonName: 'Spring 2026',
			offeringName: 'Basketball',
			leagueName: "Men's Competitive",
			divisionName: 'Monday 6 PM',
			homeTeamName: 'Wildcats',
			awayTeamName: 'Falcons',
			location: 'Main Gym - Court A',
			matchup: 'Wildcats vs Falcons'
		});
		expect(mocks.dbOps.events.create).toHaveBeenCalledWith(
			expect.objectContaining({
				clientId: 'client-1',
				offeringId: 'offering-1',
				leagueId: 'league-1',
				divisionId: 'division-1',
				homeTeamId: 'team-1',
				awayTeamId: 'team-2',
				status: 'scheduled',
				type: 'game',
				createdUser: 'user-1',
				updatedUser: 'user-1'
			})
		);
	});
});
