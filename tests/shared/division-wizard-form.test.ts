/*
Brief description:
This file verifies normalization helpers for the create-division wizard form state.

Deeper explanation:
The create-division wizard uses a numeric input for max teams, which means Svelte can hand route state a
number even though the form model mostly treats fields like strings. These tests protect the shared
normalization path so draft creation does not crash when max teams comes through as a number, and so the
stored draft shape stays consistent for later validation and submission.

Summary of tests:
1. It verifies that numeric max-teams input from the wizard is normalized into a trimmed string draft value.
2. It verifies that string-based form values are still trimmed and preserved correctly.
*/

import { describe, expect, it } from 'vitest';

import { cloneDivisionWizardForm, normalizeCreateDivisionDraft } from '../../src/lib/utils/division-wizard-form';

describe('division wizard form normalization', () => {
	it('normalizes numeric max-teams values from the bound number input', () => {
		// the browser can hand the wizard a number here, so draft normalization must not call trim on it.
		expect(
			normalizeCreateDivisionDraft(
				{
					name: ' Monday 6:00 PM ',
					slug: ' Monday 600 PM ',
					maxTeams: 6,
					description: ' evening games ',
					dayOfWeek: ' Monday ',
					gameTime: ' 6:00 PM ',
					location: ' Rec Center ',
					startDate: ' 2026-05-01 ',
					isLocked: true
				},
				'draft-1'
			)
		).toEqual({
			draftId: 'draft-1',
			name: 'Monday 6:00 PM',
			slug: 'monday-600-pm',
			maxTeams: '6',
			description: 'evening games',
			dayOfWeek: 'Monday',
			gameTime: '6:00 PM',
			location: 'Rec Center',
			startDate: '2026-05-01',
			isLocked: true
		});
	});

	it('clones form values into a stable string-backed shape', () => {
		// cloning should keep the draft/edit forms safe even if max teams already became numeric upstream.
		expect(
			cloneDivisionWizardForm({
				name: 'Tuesday',
				slug: 'tuesday',
				maxTeams: 8,
				description: '',
				dayOfWeek: 'Tuesday',
				gameTime: '',
				location: '',
				startDate: '',
				isLocked: false
			})
		).toEqual({
			name: 'Tuesday',
			slug: 'tuesday',
			maxTeams: '8',
			description: '',
			dayOfWeek: 'Tuesday',
			gameTime: '',
			location: '',
			startDate: '',
			isLocked: false
		});
	});
});
