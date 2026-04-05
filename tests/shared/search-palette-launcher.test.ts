/*
Brief description:
This file verifies the keyboard activation rules for the dashboard search palette launcher.

Deeper explanation:
The launcher sits in the normal page tab order, so keyboard users will eventually focus it while
moving across the page. These tests protect the rule that focus alone should stay passive, while
explicit activation keys like Enter and Space should open the palette on purpose.

Summary of tests:
1. It verifies that Enter activates the launcher.
2. It verifies that Space activates the launcher.
3. It verifies that Tab and Escape do not count as launcher activation keys.
*/

import { describe, expect, it } from 'vitest';
import { isSearchPaletteLauncherActivationKey } from '../../src/lib/search/launcher';

describe('search palette launcher helpers', () => {
	it('treats enter as an activation key', () => {
		// enter is the standard keyboard action for activating a focused control.
		expect(isSearchPaletteLauncherActivationKey('Enter')).toBe(true);
	});

	it('treats space as an activation key', () => {
		// space should mirror enter so keyboard users can intentionally open the palette either way.
		expect(isSearchPaletteLauncherActivationKey(' ')).toBe(true);
		expect(isSearchPaletteLauncherActivationKey('Spacebar')).toBe(true);
	});

	it('ignores non-activation keys', () => {
		// tab focus must stay passive so the palette does not pop open during normal page navigation.
		expect(isSearchPaletteLauncherActivationKey('Tab')).toBe(false);
		expect(isSearchPaletteLauncherActivationKey('Escape')).toBe(false);
	});
});
