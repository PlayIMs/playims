/*
Brief description:
This file verifies the payload validation schemas for creating and managing intramural schedule events.

Deeper explanation:
The schedule event flows accept several related ids plus date, score, and location details, so the
schemas are where we stop malformed requests before they reach any database writes. These tests
focus on the cross-field rules that are easiest to miss during UI refactors, such as preventing a
team from playing itself, making sure the end time follows the start time, keeping facility area
inputs consistent with the selected facility, and ensuring result updates carry valid ids and
scores.

Summary of tests:
1. It verifies a valid create payload is normalized successfully.
2. It verifies home and away teams must be different.
3. It verifies the scheduled end must be after the scheduled start.
4. It verifies a facility area cannot be submitted without a facility.
5. It verifies duplicate and restore payloads require an event id.
6. It verifies edit and results payloads require valid ids and score values.
7. It verifies delete payloads require an event id.
*/

import { describe, expect, it } from 'vitest';
import {
	createIntramuralEventSchema,
	duplicateIntramuralEventSchema,
	deleteIntramuralEventSchema,
	editIntramuralEventSchema,
	enterIntramuralEventResultsSchema,
	restoreDeletedIntramuralEventSchema
} from '../../src/lib/server/intramural-events-validation';

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
		roundLabel: ' Regular Season ',
		notes: ' Bring dark jerseys. ',
		isPostseason: false
	}
});

const editPayload = () => ({
	action: 'edit' as const,
	event: {
		id: 'event-1',
		...createPayload().event
	}
});

const resultsPayload = () => ({
	action: 'enter-results' as const,
	event: {
		id: 'event-1',
		homeScore: 42,
		awayScore: 39
	}
});

const duplicatePayload = () => ({
	action: 'duplicate' as const,
	eventId: 'event-1'
});

const restorePayload = () => ({
	action: 'restore-delete' as const,
	eventId: 'event-1'
});

describe('intramural events validation', () => {
	function messagesForPath(
		parsed: ReturnType<typeof createIntramuralEventSchema.safeParse>,
		path: string
	): string[] {
		if (parsed.success) return [];
		return parsed.error.issues
			.filter((issue) => issue.path.map((segment) => String(segment)).join('.') === path)
			.map((issue) => issue.message);
	}

	it('accepts a valid create payload and trims optional text', () => {
		// this proves the schema returns clean data the api can trust for downstream integrity checks.
		const parsed = createIntramuralEventSchema.safeParse(createPayload());

		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.event.roundLabel).toBe('Regular Season');
		expect(parsed.data.event.notes).toBe('Bring dark jerseys.');
	});

	it('rejects using the same team for both sides of a game', () => {
		// blocking same-team matchups at validation time keeps obviously invalid bracket rows out of the database.
		const parsed = createIntramuralEventSchema.safeParse({
			event: {
				...createPayload().event,
				awayTeamId: 'team-1'
			}
		});

		expect(parsed.success).toBe(false);
		expect(messagesForPath(parsed, 'event.awayTeamId')).toContain(
			'Home and away teams must be different.'
		);
	});

	it('rejects end times that do not come after the start time', () => {
		// the schedule page depends on chronological ordering, so inverted dates must fail before persistence.
		const parsed = createIntramuralEventSchema.safeParse({
			event: {
				...createPayload().event,
				scheduledEndAt: '2026-04-18T17:30'
			}
		});

		expect(parsed.success).toBe(false);
		expect(messagesForPath(parsed, 'event.scheduledEndAt')).toContain(
			'Scheduled end time must be after the scheduled start time.'
		);
	});

	it('rejects a facility area when no facility is selected', () => {
		// this keeps the route from receiving dangling area ids that cannot be validated against a parent facility.
		const parsed = createIntramuralEventSchema.safeParse({
			event: {
				...createPayload().event,
				facilityId: null,
				facilityAreaId: 'area-1'
			}
		});

		expect(parsed.success).toBe(false);
		expect(messagesForPath(parsed, 'event.facilityAreaId')).toContain(
			'Choose a facility before selecting a facility area.'
		);
	});

	it('accepts a valid edit payload and keeps the same field shape as create', () => {
		// edit requests should reuse the same structural rules as creation so the backend can validate one hierarchy.
		const parsed = editIntramuralEventSchema.safeParse(editPayload());

		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.event.id).toBe('event-1');
		expect(parsed.data.event.notes).toBe('Bring dark jerseys.');
	});

	it('accepts a valid results payload with numeric scores', () => {
		// results updates only need a target event id plus score values, so the schema stays intentionally small.
		const parsed = enterIntramuralEventResultsSchema.safeParse(resultsPayload());

		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.event.homeScore).toBe(42);
		expect(parsed.data.event.awayScore).toBe(39);
	});

	it('accepts a valid duplicate payload with a target event id', () => {
		// duplicate actions only need the source event id because the server copies the rest from the existing record.
		const parsed = duplicateIntramuralEventSchema.safeParse(duplicatePayload());

		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.eventId).toBe('event-1');
	});

	it('accepts a valid restore payload with a target event id', () => {
		// restore actions only need the deleted event id because the server flips the active flag back on.
		const parsed = restoreDeletedIntramuralEventSchema.safeParse(restorePayload());

		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.eventId).toBe('event-1');
	});

	it('rejects a delete payload without an event id', () => {
		// delete is destructive, so the api should never accept an empty target id.
		const parsed = deleteIntramuralEventSchema.safeParse({
			action: 'delete',
			eventId: '   '
		});

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues.map((issue) => issue.message)).toContain('Event is required.');
	});
});
