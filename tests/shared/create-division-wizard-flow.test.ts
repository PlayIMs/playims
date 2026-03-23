/*
Brief description:
This file verifies the step flow metadata for the create-division collection wizard.

Deeper explanation:
The league-page create-division wizard now needs to open directly on the division details form, then
move to the draft list after the user adds a division. These tests lock down that flow so future wizard
refactors do not accidentally reintroduce the old context-first step or send users to the wrong next
screen after adding a draft.

Summary of tests:
1. It verifies that the wizard starts on the division details step with a draft active.
2. It verifies that the wizard moves to the divisions list after a draft is added.
3. It verifies that step titles and next-button labels match the new flow.
*/

import { describe, expect, it } from 'vitest';

import {
	getCreateDivisionWizardInitialFlowState,
	getCreateDivisionWizardNextLabel,
	getCreateDivisionWizardPostAddFlowState,
	getCreateDivisionWizardStepTitle
} from '../../src/lib/utils/create-division-wizard-flow';

describe('create division wizard flow', () => {
	it('starts directly on the division details form', () => {
		// opening the wizard from the league page should drop the user straight into the first draft form.
		expect(getCreateDivisionWizardInitialFlowState()).toEqual({
			step: 1,
			draftActive: true
		});
	});

	it('returns to the division list after a draft is added', () => {
		// once a draft is saved, the user should land on the collection step for duplicate/reorder/remove actions.
		expect(getCreateDivisionWizardPostAddFlowState()).toEqual({
			step: 2,
			draftActive: false
		});
	});

	it('uses step titles and footer labels that match the new sequence', () => {
		// the wizard copy should reflect details first, then list management, then review.
		expect(getCreateDivisionWizardStepTitle(1)).toBe('Division Details');
		expect(getCreateDivisionWizardStepTitle(2)).toBe('Divisions');
		expect(getCreateDivisionWizardStepTitle(3)).toBe('Review & Create');
		expect(getCreateDivisionWizardNextLabel(1, true, null)).toBe('Add Division');
		expect(getCreateDivisionWizardNextLabel(1, true, 0)).toBe('Update Division');
		expect(getCreateDivisionWizardNextLabel(2, false, null)).toBe('Review');
	});
});
