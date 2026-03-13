/*
Brief description:
This file verifies the shared wizard dirty-state helper that controls unsaved-change prompts.

Deeper explanation:
Several wizards open with prefilled values such as a selected offering, division, season, or copied
record data. If the dirty check assumes a blank form instead of the values present at open time,
the user gets a discard confirmation before making any change. These tests lock the helper to an
open-time baseline model so prefilled defaults stay clean until the user actually edits something.

Summary of tests:
1. It treats prefilled values captured at open time as clean until one of those values changes.
2. It supports normalized snapshots so UI-only typing differences can be ignored when needed.
3. It resets correctly after the wizard baseline is cleared and recaptured.
*/

import { describe, expect, it } from 'vitest';
import { createWizardDirtyState } from '../../src/lib/components/wizard/wizard-dirty-state';

describe('wizard dirty state', () => {
	it('treats prefilled open-state values as clean until data actually changes', () => {
		const dirtyState = createWizardDirtyState<{
			offeringId: string;
			divisionId: string;
			name: string;
		}>();
		const initialValue = {
			offeringId: 'offering-1',
			divisionId: 'division-7',
			name: ''
		};

		dirtyState.captureBaseline(initialValue);

		expect(dirtyState.isDirty(initialValue)).toBe(false);
		expect(
			dirtyState.isDirty({
				offeringId: 'offering-1',
				divisionId: 'division-7',
				name: 'Blue Team'
			})
		).toBe(true);
	});

	it('supports normalized snapshots for routes that trim or canonicalize form values', () => {
		const dirtyState = createWizardDirtyState<{ name: string; slug: string }>({
			snapshot: (value) => ({
				name: value.name.trim(),
				slug: value.slug.trim().toLowerCase()
			})
		});

		dirtyState.captureBaseline({
			name: 'Monday 6:00 PM',
			slug: 'monday-600-pm'
		});

		expect(
			dirtyState.isDirty({
				name: ' Monday 6:00 PM ',
				slug: 'MONDAY-600-PM'
			})
		).toBe(false);
		expect(
			dirtyState.isDirty({
				name: 'Monday 7:00 PM',
				slug: 'monday-700-pm'
			})
		).toBe(true);
	});

	it('can clear and recapture a new baseline after a wizard resets', () => {
		const dirtyState = createWizardDirtyState<{ seasonId: string; copyEnabled: boolean }>();

		dirtyState.captureBaseline({
			seasonId: 'spring-2026',
			copyEnabled: false
		});
		expect(
			dirtyState.isDirty({
				seasonId: 'spring-2026',
				copyEnabled: true
			})
		).toBe(true);

		dirtyState.clearBaseline();
		expect(
			dirtyState.isDirty({
				seasonId: 'spring-2026',
				copyEnabled: true
			})
		).toBe(false);

		dirtyState.captureBaseline({
			seasonId: 'fall-2026',
			copyEnabled: true
		});
		expect(
			dirtyState.isDirty({
				seasonId: 'fall-2026',
				copyEnabled: true
			})
		).toBe(false);
	});
});
