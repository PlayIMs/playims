/*
Brief description:
This file verifies the shared mega search controller that coordinates the header launcher and palette.

Deeper explanation:
The new dashboard header input and the existing palette now share one controller instead of each owning
their own local state. These tests lock in the contract for opening, seeding query text, resetting state,
and resolving the OS-specific shortcut label so future UI refactors do not silently split those flows apart.

Summary of tests:
1. It verifies that keyboard and launcher openings both drive the same shared state.
2. It verifies that launcher-seeded queries persist while open and reset when the palette closes.
3. It verifies that the shortcut hint resolves to Cmd on Apple platforms and Ctrl elsewhere.
*/

import { describe, expect, it } from 'vitest';
import {
	clearMegaSearchHighlightedIndex,
	closeMegaSearchPalette,
	openMegaSearchPalette,
	readMegaSearchControllerState,
	resetMegaSearchControllerState,
	resolveMegaSearchShortcutHint,
	setMegaSearchHighlightedIndex,
	setMegaSearchQuery,
	setMegaSearchScopedSeasonId
} from '../../src/lib/search/controller';

describe('mega search controller', () => {
	it('shares state between keyboard and launcher openings', () => {
		// both entry points should manipulate one controller so the launcher never drifts from the palette.
		resetMegaSearchControllerState();

		openMegaSearchPalette('keyboard', '');
		expect(readMegaSearchControllerState()).toMatchObject({
			open: true,
			query: '',
			source: 'keyboard'
		});

		setMegaSearchQuery('corec');
		openMegaSearchPalette('launcher', 'corec softball');

		expect(readMegaSearchControllerState()).toMatchObject({
			open: true,
			query: 'corec softball',
			source: 'launcher'
		});
	});

	it('resets launcher-visible state when the palette closes', () => {
		// closing the palette should clear the shared query and selection state so the header field resets too.
		resetMegaSearchControllerState();

		openMegaSearchPalette('launcher', 'division a');
		setMegaSearchScopedSeasonId('season-1');
		setMegaSearchHighlightedIndex(4);

		expect(readMegaSearchControllerState()).toMatchObject({
			open: true,
			query: 'division a',
			scopedSeasonId: 'season-1',
			highlightedIndex: 4
		});

		closeMegaSearchPalette();

		expect(readMegaSearchControllerState()).toMatchObject({
			open: false,
			query: '',
			scopedSeasonId: '',
			highlightedIndex: -1
		});
	});

	it('can clear the highlighted result without closing the palette', () => {
		// mouse-driven palettes need to drop the active row when the pointer leaves the modal.
		resetMegaSearchControllerState();

		openMegaSearchPalette('launcher', 'basketball');
		setMegaSearchHighlightedIndex(2);

		clearMegaSearchHighlightedIndex();

		expect(readMegaSearchControllerState()).toMatchObject({
			open: true,
			query: 'basketball',
			highlightedIndex: -1
		});
	});

	it('resolves the platform shortcut hint', () => {
		// the launcher should only advertise the shortcut key that matches the current operating system.
		expect(resolveMegaSearchShortcutHint('macintosh safari')).toBe('Cmd + K');
		expect(resolveMegaSearchShortcutHint('windows chrome')).toBe('Ctrl + K');
	});
});
