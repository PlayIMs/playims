/*
Brief description:
This file verifies the shared step-visibility helpers for the create offering wizard.

Deeper explanation:
The new offering wizard now has a conditional link-across-seasons step that should appear only
when the current offering matches an existing offering in another season, or when a link was
already selected and must remain editable. These tests protect that branching logic without
requiring a brittle modal integration test.

Summary of tests:
1. It verifies that the link step is shown when matching offerings exist.
2. It verifies that the link step stays visible when an existing linked offering is already selected.
3. It verifies that the visible step list skips the link step when the offering is new.
*/

import { describe, expect, it } from 'vitest';

import {
	getCreateOfferingVisibleSteps,
	shouldShowOfferingLinkStep
} from '../../src/lib/utils/offering-wizard-steps';

describe('offering wizard step utilities', () => {
	it('shows the link step when matching offerings exist', () => {
		// matching candidates mean the user should get an explicit chance to link across seasons.
		expect(shouldShowOfferingLinkStep(2, '')).toBe(true);
		expect(getCreateOfferingVisibleSteps(true)).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it('keeps the link step visible when an existing link is already selected', () => {
		// a previously selected link must remain editable even if the candidate list changes later.
		expect(shouldShowOfferingLinkStep(0, 'linked-offering-id')).toBe(true);
	});

	it('skips the link step when the offering is new', () => {
		// brand-new offerings should move straight from basics to setup with no empty link screen.
		expect(shouldShowOfferingLinkStep(0, '')).toBe(false);
		expect(getCreateOfferingVisibleSteps(false)).toEqual([1, 3, 4, 5, 6]);
	});
});
