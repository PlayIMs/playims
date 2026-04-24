/*
Brief description:
This file verifies the secure API route that edits, scores, and deletes intramural schedule events.

Deeper explanation:
These mutations are high trust because they can change the schedule, results, or permanently remove
games. The tests protect the route contract by checking permission gates, validation, hierarchy
enforcement, event-not-found handling, and the returned schedule record shape after each mutation.

Summary of tests:
1. It verifies the route fails early when the D1 binding is missing.
2. It verifies participants without offering-management permission are rejected.
3. It verifies edit payloads return field-level validation errors.
4. It verifies valid edits update the game and return a refreshed schedule record.
5. It verifies valid results updates score the game and mark it completed.
6. It verifies duplicate requests create a fresh scheduled copy and return a refreshed schedule record.
7. It verifies delete requests deactivate a game and return a success payload.
8. It verifies restore requests reactivate the game and return a refreshed schedule record.
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
			getByClientIdAndId: vi.fn(),
			create: vi.fn(),
			updateByClientIdAndId: vi.fn(),
			deleteByClientIdAndId: vi.fn()
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

import { DELETE, PATCH, POST } from '../../src/routes/api/intramural-sports/events/+server';

const createEditPayload = () => ({
	action: 'edit' as const,
	event: {
		id: 'event-1',
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

const createResultsPayload = () => ({
	action: 'enter-results' as const,
	event: {
		id: 'event-1',
		homeScore: 45,
		awayScore: 40
	}
});

const createDuplicatePayload = () => ({
	action: 'duplicate' as const,
	eventId: 'event-1'
});

const createDeletePayload = () => ({
	action: 'delete' as const,
	eventId: 'event-1'
});

const createRestorePayload = () => ({
	action: 'restore-delete' as const,
	eventId: 'event-1'
});

const baseEvent = {
	id: 'event-1',
	type: 'game',
	status: 'scheduled',
	statusLabel: 'Scheduled',
	rawStatus: 'scheduled',
	scheduledStartAt: '2026-04-18T18:00:00.000Z',
	scheduledEndAt: '2026-04-18T19:00:00.000Z',
	isActive: 1,
	seasonId: 'season-1',
	seasonName: 'Spring 2026',
	offeringId: 'offering-1',
	offeringName: 'Basketball',
	offeringSlug: 'basketball',
	leagueId: 'league-1',
	leagueName: "Men's Competitive",
	leagueSlug: 'mens-competitive',
	divisionId: 'division-1',
	divisionName: 'Monday 6 PM',
	divisionSlug: 'monday-6-pm',
	homeTeamId: 'team-1',
	homeTeamName: 'Wildcats',
	homeTeamSlug: 'wildcats',
	awayTeamId: 'team-2',
	awayTeamName: 'Falcons',
	awayTeamSlug: 'falcons',
	matchup: 'Wildcats vs Falcons',
	facilityId: 'facility-1',
	facilityName: 'Main Gym',
	facilityAreaId: 'area-1',
	facilityAreaName: 'Court A',
	location: 'Main Gym - Court A',
	weekNumber: 4,
	roundLabel: 'Regular Season',
	notes: 'Bring dark jerseys.',
	isPostseason: false,
	score: null,
	scoreSortValue: 0
};

const createRequestEvent = (input?: {
	role?: string;
	withDatabase?: boolean;
	body?: unknown;
	method?: 'PATCH' | 'DELETE' | 'POST';
}) => {
	const url = new URL('https://playims.test/api/intramural-sports/events');
	return {
		url,
		request: new Request(url, {
			method: input?.method ?? 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(input?.body ?? createEditPayload())
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

describe('intramural events manage route', () => {
	beforeEach(() => {
		// each test starts with the same trusted event tree so the mutation branches stay easy to follow.
		vi.clearAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});

		mocks.dbOps.seasons.getByClientIdAndId.mockResolvedValue({
			id: 'season-1',
			name: 'Spring 2026',
			slug: 'spring-2026'
		});
		mocks.dbOps.offerings.getByClientIdAndId.mockResolvedValue({
			id: 'offering-1',
			seasonId: 'season-1',
			name: 'Basketball',
			slug: 'basketball'
		});
		mocks.dbOps.leagues.getByClientIdAndId.mockResolvedValue({
			id: 'league-1',
			offeringId: 'offering-1',
			seasonId: 'season-1',
			name: "Men's Competitive",
			slug: 'mens-competitive'
		});
		mocks.dbOps.divisions.getById.mockResolvedValue({
			id: 'division-1',
			leagueId: 'league-1',
			name: 'Monday 6 PM',
			slug: 'monday-6-pm'
		});
		mocks.dbOps.teams.getByClientIdAndDivisionIds.mockResolvedValue([
			{
				id: 'team-1',
				divisionId: 'division-1',
				name: 'Wildcats',
				slug: 'wildcats',
				isActive: 1
			},
			{
				id: 'team-2',
				divisionId: 'division-1',
				name: 'Falcons',
				slug: 'falcons',
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
		mocks.dbOps.events.getByClientIdAndId.mockResolvedValue(baseEvent);
		mocks.dbOps.events.updateByClientIdAndId.mockImplementation(
			async (_clientId, _eventId, data) => ({
				...baseEvent,
				...data,
				id: _eventId
			})
		);
		mocks.dbOps.events.create.mockResolvedValue({
			...baseEvent,
			id: 'event-duplicate'
		});
		mocks.dbOps.events.deleteByClientIdAndId.mockResolvedValue(true);
	});

	it('fails fast when the D1 binding is unavailable', async () => {
		// this keeps the route from pretending a mutation worked when the platform binding is missing.
		const response = await PATCH(createRequestEvent({ withDatabase: false }));
		const payload = await response.json();

		expect(response.status).toBe(500);
		expect(payload.error).toBe('Unable to save event right now.');
	});

	it('rejects callers without offering management permission', async () => {
		// the route must enforce its own mutation permission because ui affordances alone are not security.
		const response = await PATCH(createRequestEvent({ role: 'participant' }));
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.error).toBe(
			'Only managers, administrators, and developers can manage schedule events.'
		);
		expect(mocks.dbOps.events.updateByClientIdAndId).not.toHaveBeenCalled();
	});

	it('returns validation errors for invalid edit bodies', async () => {
		// field-level errors let the wizard explain exactly what the user needs to fix without server guesswork.
		const response = await PATCH(
			createRequestEvent({
				body: {
					action: 'edit',
					event: {
						...createEditPayload().event,
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
		expect(mocks.dbOps.events.updateByClientIdAndId).not.toHaveBeenCalled();
	});

	it('updates an event and returns the refreshed schedule record', async () => {
		// returning the mapped schedule shape lets the page update instantly instead of rebuilding names locally.
		const response = await PATCH(
			createRequestEvent({
				body: createEditPayload()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.event).toMatchObject({
			id: 'event-1',
			offeringName: 'Basketball',
			leagueName: "Men's Competitive",
			divisionName: 'Monday 6 PM',
			homeTeamName: 'Wildcats',
			awayTeamName: 'Falcons',
			location: 'Main Gym - Court A',
			matchup: 'Wildcats vs Falcons'
		});
		expect(mocks.dbOps.events.updateByClientIdAndId).toHaveBeenCalledWith(
			'client-1',
			'event-1',
			expect.objectContaining({
				offeringId: 'offering-1',
				leagueId: 'league-1',
				divisionId: 'division-1',
				homeTeamId: 'team-1',
				awayTeamId: 'team-2',
				updatedUser: 'user-1'
			})
		);
	});

	it('scores an event and marks it completed when entering results', async () => {
		// a results update should persist the score and close the game so the schedule reflects the final state.
		const response = await PATCH(
			createRequestEvent({
				body: createResultsPayload()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.event.status).toBe('completed');
		expect(payload.data.event.score).toBe('45 - 40');
		expect(mocks.dbOps.events.updateByClientIdAndId).toHaveBeenCalledWith(
			'client-1',
			'event-1',
			expect.objectContaining({
				status: 'completed',
				homeScore: 45,
				awayScore: 40,
				winnerTeamId: 'team-1',
				updatedUser: 'user-1'
			})
		);
	});

	it('duplicates an event and returns the refreshed schedule record', async () => {
		// duplicating should create a fresh scheduled copy so users can reuse the matchup immediately.
		const response = await POST(
			createRequestEvent({
				method: 'POST',
				body: createDuplicatePayload()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(201);
		expect(payload.success).toBe(true);
		expect(payload.data.event).toMatchObject({
			id: 'event-duplicate',
			status: 'scheduled',
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

	it('deletes a game and returns success', async () => {
		// deleting should deactivate the row so undo can bring it back without rebuilding the game.
		const response = await DELETE(
			createRequestEvent({
				method: 'DELETE',
				body: createDeletePayload()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.eventId).toBe('event-1');
		expect(mocks.dbOps.events.updateByClientIdAndId).toHaveBeenCalledWith(
			'client-1',
			'event-1',
			expect.objectContaining({
				isActive: 0,
				updatedUser: 'user-1'
			})
		);
		expect(mocks.dbOps.events.deleteByClientIdAndId).not.toHaveBeenCalled();
	});

	it('restores a deleted game and returns the refreshed schedule record', async () => {
		// restoring only needs to flip the active flag back on because the deleted row still exists in the database.
		const response = await PATCH(
			createRequestEvent({
				method: 'PATCH',
				body: createRestorePayload()
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.event).toMatchObject({
			id: 'event-1',
			offeringName: 'Basketball',
			leagueName: "Men's Competitive",
			divisionName: 'Monday 6 PM',
			homeTeamName: 'Wildcats',
			awayTeamName: 'Falcons',
			location: 'Main Gym - Court A',
			matchup: 'Wildcats vs Falcons'
		});
		expect(mocks.dbOps.events.updateByClientIdAndId).toHaveBeenCalledWith(
			'client-1',
			'event-1',
			expect.objectContaining({
				isActive: 1,
				updatedUser: 'user-1'
			})
		);
	});
});
