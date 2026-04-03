/*
Brief description:
This file verifies the pure validation helpers that support the club sports creation wizards.

Deeper explanation:
The club sports dashboard now uses offerings-style wizard modals for creating seasons and club sports.
These tests keep the wizard rules stable without depending on component rendering, so duplicate checks,
step gating, and copy-option dependencies stay correct as the page evolves.

Summary of tests:
1. It verifies that season details validation catches duplicate names and date-range issues.
2. It verifies that season copy validation blocks invalid dependent selections.
3. It verifies that club sport validation catches duplicate names and slugs within the selected season.
4. It verifies that league validation catches duplicate names and slugs within the selected club sport.
*/

import { describe, expect, it } from 'vitest';

import {
	firstInvalidClubSeasonWizardStep,
	firstInvalidClubLeagueWizardStep,
	firstInvalidClubSportWizardStep,
	getClubLeagueWizardStepErrors,
	getClubSeasonWizardStepErrors,
	getClubSportWizardStepErrors,
	type ClubLeagueWizardForm,
	type ClubSeasonWizardForm,
	type ClubSeasonWizardCopyForm,
	type ClubSportWizardForm
} from '../../src/routes/dashboard/clubs/club-wizard-validation';

const seasons = [
	{
		id: 'season-1',
		name: '2025-2026',
		slug: '2025-2026'
	},
	{
		id: 'season-2',
		name: '2024-2025',
		slug: '2024-2025'
	}
];

const activities = [
	{
		seasonId: 'season-1',
		clubId: 'club-1',
		clubName: 'Ice Hockey',
		clubSlug: 'ice-hockey',
		leagueName: "Men's League",
		leagueSlug: 'mens-league'
	},
	{
		seasonId: 'season-1',
		clubId: 'club-1',
		clubName: 'Ice Hockey',
		clubSlug: 'ice-hockey',
		leagueName: "Men's League",
		leagueSlug: 'mens-league'
	},
	{
		seasonId: 'season-2',
		clubId: 'club-2',
		clubName: 'Volleyball',
		clubSlug: 'volleyball',
		leagueName: "Women's League",
		leagueSlug: 'womens-league'
	}
];

describe('club wizard validation', () => {
	it('validates season details on the first step', () => {
		const form: ClubSeasonWizardForm = {
			name: '2025-2026',
			slug: '2025-2026',
			startDate: '2026-09-01',
			endDate: '2026-08-31',
			isCurrent: true
		};
		const copy: ClubSeasonWizardCopyForm = {
			enabled: false,
			sourceSeasonIds: [],
			includeClubs: true,
			includeLeagues: true,
			includeTeams: true,
			includeOfficers: false,
			includeRosters: false,
			includeSchedules: false
		};

		const errors = getClubSeasonWizardStepErrors(form, copy, seasons, 1);

		expect(errors).toMatchObject({
			'season.name': 'A club season with this name already exists.',
			'season.slug': 'A club season with this slug already exists.',
			'season.endDate': 'End date must be on or after the start date.'
		});
		expect(firstInvalidClubSeasonWizardStep(errors)).toBe(1);
	});

	it('validates season copy dependencies on the copy step', () => {
		const form: ClubSeasonWizardForm = {
			name: '2026-2027',
			slug: '2026-2027',
			startDate: '2026-09-01',
			endDate: '2027-04-30',
			isCurrent: true
		};
		const copy: ClubSeasonWizardCopyForm = {
			enabled: true,
			sourceSeasonIds: [],
			includeClubs: false,
			includeLeagues: false,
			includeTeams: true,
			includeOfficers: true,
			includeRosters: true,
			includeSchedules: true
		};

		const errors = getClubSeasonWizardStepErrors(form, copy, seasons, 2);

		expect(errors).toMatchObject({
			'copy.sourceSeasonIds': 'Choose at least one source season.',
			'copy.includeClubs':
				'Clubs must be included before leagues, teams, or officers can be copied.',
			'copy.includeTeams': 'Teams can only be copied when leagues are included.',
			'copy.includeRosters': 'Rosters can only be copied when teams are included.'
		});
		expect(firstInvalidClubSeasonWizardStep(errors)).toBe(2);
	});

	it('validates club sport uniqueness within the selected season', () => {
		const form: ClubSportWizardForm = {
			clubSeasonId: 'season-1',
			name: 'Ice Hockey',
			slug: 'ice-hockey',
			sport: 'Ice Hockey'
		};

		const errors = getClubSportWizardStepErrors(form, activities, 1);

		expect(errors).toMatchObject({
			'club.name': 'A club sport with this name already exists for the selected season.',
			'club.slug': 'A club sport with this slug already exists for the selected season.'
		});
		expect(firstInvalidClubSportWizardStep(errors)).toBe(1);
	});

	it('validates league uniqueness within the selected club sport', () => {
		// league duplicates should surface before the user reaches the review step.
		const form: ClubLeagueWizardForm = {
			clubId: 'club-1',
			name: "Men's League",
			slug: 'mens-league',
			gender: "Men's"
		};

		const errors = getClubLeagueWizardStepErrors(form, activities, 1);

		expect(errors).toMatchObject({
			'league.name': 'A league with this name already exists for the selected club sport.',
			'league.slug': 'A league with this slug already exists for the selected club sport.'
		});
		expect(firstInvalidClubLeagueWizardStep(errors)).toBe(1);
	});
});
