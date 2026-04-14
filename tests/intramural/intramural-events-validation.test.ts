/*
Brief description:
This file verifies the payload validation schema for creating intramural schedule events.

Deeper explanation:
The create-event flow accepts several related ids plus date and location details, so the schema is
where we stop malformed requests before they reach any database writes. These tests focus on the
cross-field rules that are easiest to miss during UI refactors, such as preventing a team from
playing itself, making sure the end time follows the start time, and keeping facility area inputs
consistent with the selected facility.

Summary of tests:
1. It verifies a valid payload is normalized successfully.
2. It verifies home and away teams must be different.
3. It verifies the scheduled end must be after the scheduled start.
4. It verifies a facility area cannot be submitted without a facility.
*/

import { describe, expect, it } from 'vitest';
import { createIntramuralEventSchema } from '../../src/lib/server/intramural-events-validation';

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

	it('accepts a valid event payload and trims optional text', () => {
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
});
