/*
Brief description:
This file verifies the season action menu options used by the dashboard home page.

Deeper explanation:
The dashboard current-season card now swaps the old static offerings link for an action menu. These
tests protect the small decision rules behind that menu so admins see the right next steps when a
season exists and still get a useful create path when no season history is available yet. They also
lock in the simplified title-case labels that match the dashboard's split-button UX.

Summary of tests:
1. It verifies that existing season history includes the manage and create actions in title case.
2. It verifies that empty season history skips the manage action and still offers create season.
*/

import { describe, expect, it } from 'vitest';

import { buildDashboardSeasonActionOptions } from '../../src/routes/dashboard/dashboard-season-actions';

describe('dashboard season action options', () => {
	it('includes manage-seasons when season history exists', () => {
		// admins with seasons should be able to jump straight into the shared management modal.
		expect(buildDashboardSeasonActionOptions({ hasSeasonHistory: true })).toEqual([
			{
				value: 'manage-seasons',
				label: 'Manage Seasons'
			},
			{
				value: 'create-season',
				label: 'Create Season'
			}
		]);
	});

	it('keeps create action when no season history exists', () => {
		// a brand-new organization cannot manage missing seasons, but it still needs a clear way to start one.
		expect(buildDashboardSeasonActionOptions({ hasSeasonHistory: false })).toEqual([
			{
				value: 'create-season',
				label: 'Create Season'
			}
		]);
	});
});
