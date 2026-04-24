/*
Brief description:
This file verifies the shared step helper logic for the schedule event wizard.

Deeper explanation:
The event modal is being split into a real wizard, which means the client now needs one source of
truth for step titles, progress, and per-step validation. These tests protect that shared helper so
the modal can block advancement at the right time and keep the submit gating aligned with the
server's required event fields.

Summary of tests:
1. It verifies the wizard exposes the expected step titles and total step count.
2. It verifies the competition step catches missing season, offering, league, and division values.
3. It verifies the schedule step catches invalid times and missing facility context.
4. It verifies the matchup step catches missing or duplicate team selections.
5. It verifies the blocking error helper aggregates only the required step errors for submission.
*/

import { describe, expect, it } from 'vitest';

import {
	buildScheduleEventWizardBlockingFieldErrors,
	buildScheduleEventWizardStepErrors,
	getScheduleEventWizardStepCount,
	getScheduleEventWizardStepTitle,
	type ScheduleEventWizardForm
} from '../../src/lib/utils/schedule-event-wizard-steps';
import type { ScheduleEventWizardOptions } from '../../src/lib/utils/schedule-event-wizard';

function createOptions(): ScheduleEventWizardOptions {
	return {
		seasons: [{ id: 'season-spring', name: 'Spring 2026', isCurrent: true }],
		offerings: [{ id: 'offering-basketball', seasonId: 'season-spring', name: 'Basketball' }],
		leagues: [
			{
				id: 'league-mens',
				seasonId: 'season-spring',
				offeringId: 'offering-basketball',
				name: "Men's Competitive"
			}
		],
		divisions: [{ id: 'division-monday', leagueId: 'league-mens', name: 'Monday 6 PM' }],
		teams: [
			{ id: 'team-wildcats', divisionId: 'division-monday', name: 'Wildcats' },
			{ id: 'team-falcons', divisionId: 'division-monday', name: 'Falcons' }
		],
		facilities: [{ id: 'facility-main', name: 'Main Gym' }],
		facilityAreas: [{ id: 'area-court-a', facilityId: 'facility-main', name: 'Court A' }]
	};
}

function createForm(overrides?: Partial<ScheduleEventWizardForm>): ScheduleEventWizardForm {
	return {
		seasonId: 'season-spring',
		offeringId: 'offering-basketball',
		leagueId: 'league-mens',
		divisionId: 'division-monday',
		homeTeamId: 'team-wildcats',
		awayTeamId: 'team-falcons',
		facilityId: 'facility-main',
		facilityAreaId: 'area-court-a',
		scheduledStartAt: '2026-04-16T18:00',
		scheduledEndAt: '2026-04-16T19:00',
		weekNumber: '',
		roundLabel: '',
		notes: '',
		isPostseason: false,
		...(overrides ?? {})
	};
}

describe('schedule event wizard steps', () => {
	it('exposes the expected step titles and count', () => {
		// the modal header should stay in sync with the actual wizard structure.
		expect(getScheduleEventWizardStepCount()).toBe(4);
		expect(getScheduleEventWizardStepTitle(1)).toBe('Competition');
		expect(getScheduleEventWizardStepTitle(2)).toBe('Schedule');
		expect(getScheduleEventWizardStepTitle(3)).toBe('Matchup');
		expect(getScheduleEventWizardStepTitle(4)).toBe('Details');
	});

	it('flags missing competition selections on the first step', () => {
		// step one should stop the wizard before it advances into later schedule details.
		const errors = buildScheduleEventWizardStepErrors(
			createOptions(),
			createForm({
				seasonId: '',
				offeringId: '',
				leagueId: '',
				divisionId: ''
			}),
			1
		);

		expect(errors).toMatchObject({
			'event.seasonId': 'Choose a valid season.',
			'event.offeringId': 'Choose a valid offering.',
			'event.leagueId': 'Choose a valid league.',
			'event.divisionId': 'Choose a valid division.'
		});
	});

	it('flags invalid scheduling details on the second step', () => {
		// the date step should reject malformed or reversed times before the user reaches matchups.
		const errors = buildScheduleEventWizardStepErrors(
			createOptions(),
			createForm({
				scheduledStartAt: '2026-04-16T19:00',
				scheduledEndAt: '2026-04-16T18:00',
				facilityId: '',
				facilityAreaId: 'area-court-a'
			}),
			2
		);

		expect(errors).toMatchObject({
			'event.scheduledEndAt': 'Scheduled end time must be after the scheduled start time.',
			'event.facilityAreaId': 'Choose a facility before selecting a facility area.'
		});
	});

	it('flags missing or duplicated matchup selections on the third step', () => {
		// the matchup step should enforce two distinct teams from the chosen division.
		const errors = buildScheduleEventWizardStepErrors(
			createOptions(),
			createForm({
				homeTeamId: 'team-wildcats',
				awayTeamId: 'team-wildcats'
			}),
			3
		);

		expect(errors).toEqual({
			'event.awayTeamId': 'Home and away teams must be different.'
		});
	});

	it('aggregates the blocking submit errors across the required steps', () => {
		// final submit gating should stay aligned with the same step checks instead of inventing a second rule set.
		const errors = buildScheduleEventWizardBlockingFieldErrors(
			createOptions(),
			createForm({
				seasonId: '',
				offeringId: '',
				leagueId: '',
				divisionId: '',
				homeTeamId: '',
				awayTeamId: '',
				scheduledStartAt: '',
				scheduledEndAt: ''
			})
		);

		expect(errors).toMatchObject({
			'event.seasonId': 'Choose a valid season.',
			'event.offeringId': 'Choose a valid offering.',
			'event.leagueId': 'Choose a valid league.',
			'event.divisionId': 'Choose a valid division.',
			'event.scheduledStartAt': 'Scheduled start time is required.',
			'event.scheduledEndAt': 'Scheduled end time is required.',
			'event.homeTeamId': 'Choose a home team that belongs to the selected division.',
			'event.awayTeamId': 'Choose an away team that belongs to the selected division.'
		});
	});
});
