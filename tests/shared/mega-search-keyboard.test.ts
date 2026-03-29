/*
Brief description:
This file verifies the keyboard-navigation rules that drive mega search result highlighting.

Deeper explanation:
The palette has two related but different concepts: the highlighted result row and the browser's
actual focused element. These tests protect the keyboard contract so arrow keys move through results,
tab and shift+tab mirror that movement, and input-origin tabbing can advance the highlighted row
without pulling text-entry focus away from the search field.

Summary of tests:
1. It verifies that arrow keys move through results and focus the selected result row.
2. It verifies that tab and shift+tab from the input preserve input focus while moving the highlight.
3. It verifies that tab and shift+tab from a result row move focus with the highlighted result.
4. It verifies that highlight movement wraps from the start and end of the result list.
*/

import { describe, expect, it } from 'vitest';
import {
	getNextMegaSearchHighlightedIndex,
	resolveMegaSearchMovementIntent
} from '../../src/lib/search/keyboard';

describe('mega search keyboard helpers', () => {
	it('uses result focus for arrow-key navigation', () => {
		// arrow movement should behave like a command palette and move focus with the active row.
		expect(resolveMegaSearchMovementIntent('ArrowDown', { targetIsInput: true })).toEqual({
			offset: 1,
			focusMode: 'focus-result'
		});
		expect(resolveMegaSearchMovementIntent('ArrowUp', { targetIsResult: true })).toEqual({
			offset: -1,
			focusMode: 'focus-result'
		});
	});

	it('keeps input focus when tabbing from the search field', () => {
		// tabbing inside the input should still advance the active result without interrupting typing.
		expect(
			resolveMegaSearchMovementIntent('Tab', { targetIsInput: true, shiftKey: false })
		).toEqual({
			offset: 1,
			focusMode: 'preserve-input'
		});
		expect(resolveMegaSearchMovementIntent('Tab', { targetIsInput: true, shiftKey: true })).toEqual(
			{
				offset: -1,
				focusMode: 'preserve-input'
			}
		);
	});

	it('moves result focus when tabbing from a result row', () => {
		// once a row has focus, tabbing should continue stepping through the result list.
		expect(
			resolveMegaSearchMovementIntent('Tab', { targetIsResult: true, shiftKey: false })
		).toEqual({
			offset: 1,
			focusMode: 'focus-result'
		});
		expect(
			resolveMegaSearchMovementIntent('Tab', { targetIsResult: true, shiftKey: true })
		).toEqual({
			offset: -1,
			focusMode: 'focus-result'
		});
	});

	it('wraps highlight movement across the result list bounds', () => {
		// wrapping prevents keyboard users from getting stuck at either end of the list.
		expect(getNextMegaSearchHighlightedIndex(-1, 4, 1)).toBe(0);
		expect(getNextMegaSearchHighlightedIndex(0, 4, -1)).toBe(3);
		expect(getNextMegaSearchHighlightedIndex(3, 4, 1)).toBe(0);
		expect(getNextMegaSearchHighlightedIndex(1, 4, 1)).toBe(2);
	});
});
