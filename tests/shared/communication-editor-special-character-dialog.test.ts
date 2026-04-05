/*
Brief description:
This file verifies the open-state helper for the communications special character dialog.

Deeper explanation:
The special character modal now behaves more like a quick picker than a two-step chooser. When it
opens, nothing should be selected yet, but keyboard users should still land on the first available
character so Tab can continue across the grid in a predictable order. These tests protect that open
state so future refactors do not quietly reintroduce a default selection or lose the first-focus
target.

Summary of tests:
1. It verifies that opening the dialog starts with no selected character.
2. It verifies that opening the dialog focuses the first available character when options exist.
3. It verifies that opening the dialog exposes no focus target when the catalog is empty.
*/

import { describe, expect, it } from 'vitest';

import { buildSpecialCharacterDialogOpenState } from '../../src/lib/communications/editor-special-character-dialog';

describe('communication editor special character dialog helper', () => {
	it('starts with no selected character', () => {
		// this keeps the picker from implying a choice before the user actually clicks something.
		const state = buildSpecialCharacterDialogOpenState([{ value: '•' }, { value: '…' }]);

		expect(state.selectedValue).toBe('');
	});

	it('focuses the first available character when options exist', () => {
		// this gives keyboard users a predictable starting point for tabbing through the grid.
		const state = buildSpecialCharacterDialogOpenState([{ value: '•' }, { value: '…' }]);

		expect(state.initialFocusIndex).toBe(0);
	});

	it('has no focus target when the catalog is empty', () => {
		// this prevents the dialog from trying to focus a button that does not exist.
		const state = buildSpecialCharacterDialogOpenState([]);

		expect(state.initialFocusIndex).toBeNull();
	});
});
