/*
Brief description:
This file verifies the shared helper logic that powers the schedule page event-creation wizard.

Deeper explanation:
The event wizard has several cascading selectors whose valid options depend on earlier choices such
as season, offering, league, division, and facility. These tests protect that client-side contract
so the wizard can stay fast and predictable without duplicating relationship rules in multiple UI
handlers.

Summary of tests:
1. It verifies invalid lower-level selections are cleared when a parent selection changes.
2. It verifies the derived option collections stay scoped to the currently selected hierarchy.
3. It verifies home and away team option sets never offer the same team on both sides.
*/

import { describe, expect, it } from 'vitest';
import {
	buildScheduleEventWizardCollections,
	sanitizeScheduleEventWizardSelection,
	type ScheduleEventWizardOptions,
	type ScheduleEventWizardSelection
} from '../../src/lib/utils/schedule-event-wizard';

function createOptions(): ScheduleEventWizardOptions {
	return {
		seasons: [
			{ id: 'season-spring', name: 'Spring 2026', isCurrent: true },
			{ id: 'season-fall', name: 'Fall 2026', isCurrent: false }
		],
		offerings: [
			{ id: 'offering-basketball', seasonId: 'season-spring', name: 'Basketball' },
			{ id: 'offering-volleyball', seasonId: 'season-fall', name: 'Volleyball' }
		],
		leagues: [
			{
				id: 'league-mens',
				seasonId: 'season-spring',
				offeringId: 'offering-basketball',
				name: "Men's Competitive"
			},
			{
				id: 'league-coed',
				seasonId: 'season-fall',
				offeringId: 'offering-volleyball',
				name: 'Coed Rec'
			}
		],
		divisions: [
			{ id: 'division-monday', leagueId: 'league-mens', name: 'Monday 6 PM' },
			{ id: 'division-thursday', leagueId: 'league-coed', name: 'Thursday 7 PM' }
		],
		teams: [
			{ id: 'team-wildcats', divisionId: 'division-monday', name: 'Wildcats' },
			{ id: 'team-falcons', divisionId: 'division-monday', name: 'Falcons' },
			{ id: 'team-aces', divisionId: 'division-thursday', name: 'Aces' }
		],
		facilities: [
			{ id: 'facility-main', name: 'Main Gym' },
			{ id: 'facility-rec', name: 'Rec Center' }
		],
		facilityAreas: [
			{ id: 'area-court-a', facilityId: 'facility-main', name: 'Court A' },
			{ id: 'area-field-1', facilityId: 'facility-rec', name: 'Field 1' }
		]
	};
}

function createSelection(
	overrides?: Partial<ScheduleEventWizardSelection>
): ScheduleEventWizardSelection {
	return {
		seasonId: 'season-spring',
		offeringId: 'offering-basketball',
		leagueId: 'league-mens',
		divisionId: 'division-monday',
		homeTeamId: 'team-wildcats',
		awayTeamId: 'team-falcons',
		facilityId: 'facility-main',
		facilityAreaId: 'area-court-a',
		...(overrides ?? {})
	};
}

describe('schedule event wizard helpers', () => {
	it('clears invalid child selections when the parent hierarchy changes', () => {
		// this keeps the wizard from preserving stale ids after a user changes season, division, or facility.
		expect(
			sanitizeScheduleEventWizardSelection(createOptions(), {
				...createSelection(),
				seasonId: 'season-fall'
			})
		).toEqual({
			seasonId: 'season-fall',
			offeringId: '',
			leagueId: '',
			divisionId: '',
			homeTeamId: '',
			awayTeamId: '',
			facilityId: 'facility-main',
			facilityAreaId: 'area-court-a'
		});

		expect(
			sanitizeScheduleEventWizardSelection(createOptions(), {
				...createSelection(),
				facilityId: 'facility-rec'
			})
		).toMatchObject({
			facilityId: 'facility-rec',
			facilityAreaId: ''
		});
	});

	it('scopes derived options to the selected season, offering, league, division, and facility', () => {
		// this gives the ui a single source of truth for which dropdown options should currently be visible.
		const collections = buildScheduleEventWizardCollections(createOptions(), createSelection());

		expect(collections.offeringOptions.map((option) => option.id)).toEqual(['offering-basketball']);
		expect(collections.leagueOptions.map((option) => option.id)).toEqual(['league-mens']);
		expect(collections.divisionOptions.map((option) => option.id)).toEqual(['division-monday']);
		expect(collections.teamOptions.map((option) => option.id)).toEqual([
			'team-falcons',
			'team-wildcats'
		]);
		expect(collections.facilityAreaOptions.map((option) => option.id)).toEqual(['area-court-a']);
	});

	it('prevents the home and away option lists from offering the same team on both sides', () => {
		// avoiding duplicate matchup choices in the option list is faster and clearer than relying only on a submit error.
		const collections = buildScheduleEventWizardCollections(
			createOptions(),
			createSelection({
				homeTeamId: 'team-wildcats',
				awayTeamId: 'team-falcons'
			})
		);

		expect(collections.homeTeamOptions.map((option) => option.id)).toEqual(['team-wildcats']);
		expect(collections.awayTeamOptions.map((option) => option.id)).toEqual(['team-falcons']);
		expect(
			sanitizeScheduleEventWizardSelection(createOptions(), {
				...createSelection(),
				awayTeamId: 'team-wildcats'
			})
		).toMatchObject({
			homeTeamId: 'team-wildcats',
			awayTeamId: ''
		});
	});
});
