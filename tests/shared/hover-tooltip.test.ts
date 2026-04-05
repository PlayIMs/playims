/*
Brief description:
This file verifies the shared hover tooltip dismissal helpers for window exit scenarios.

Deeper explanation:
The tooltip component follows the cursor and renders from a body portal, which means it can stay
visible if the browser window loses the pointer before the trigger receives its normal leave event.
These tests protect the small helper rules that tell the shared tooltip when to dismiss itself after
the pointer leaves the browser window or the page becomes hidden.

Summary of tests:
1. It verifies that a window mouseout with no related target hides the tooltip.
2. It verifies that moving between in-window targets does not hide the tooltip.
3. It verifies that hidden document visibility states dismiss the tooltip.
4. It verifies that the visible document state keeps the tooltip available.
5. It verifies that alt-style shortcut labels become opt on mac and alt on other platforms.
6. It verifies that mod-style shortcut labels still map to cmd or ctrl.
*/

import { describe, expect, it } from 'vitest';
import {
	shouldHideHoverTooltipOnVisibilityChange,
	shouldHideHoverTooltipOnWindowMouseOut,
	resolveHoverTooltipShortcutKeyLabel
} from '../../src/lib/components/hover-tooltip';

describe('hover tooltip dismissal helpers', () => {
	it('hides the tooltip when the pointer leaves the browser window', () => {
		// a null relatedTarget is the browser signal that the pointer did not move onto another page element.
		expect(shouldHideHoverTooltipOnWindowMouseOut(null)).toBe(true);
	});

	it('keeps the tooltip open when the pointer moves to another in-window target', () => {
		// moving within the app should not dismiss the tooltip before the trigger's normal leave logic runs.
		expect(shouldHideHoverTooltipOnWindowMouseOut({} as EventTarget)).toBe(false);
	});

	it('hides the tooltip when the document becomes hidden', () => {
		// this covers tab switches and app deactivation where the tooltip should never stay stranded onscreen.
		expect(shouldHideHoverTooltipOnVisibilityChange('hidden')).toBe(true);
	});

	it('keeps the tooltip available when the document is visible', () => {
		// the visible state is the normal browsing path and should not force an unnecessary close.
		expect(shouldHideHoverTooltipOnVisibilityChange('visible')).toBe(false);
	});

	it('shows opt labels on mac and alt labels elsewhere', () => {
		// the shared tooltip should read like the platform's native modifier naming.
		expect(resolveHoverTooltipShortcutKeyLabel('Alt', false)).toBe('Alt');
		expect(resolveHoverTooltipShortcutKeyLabel('Alt', true)).toBe('Opt');
		expect(resolveHoverTooltipShortcutKeyLabel('Option', true)).toBe('Opt');
	});

	it('continues mapping mod labels to cmd or ctrl', () => {
		// the shared tooltip still needs to render the common command key pairing correctly.
		expect(resolveHoverTooltipShortcutKeyLabel('Mod', false)).toBe('Ctrl');
		expect(resolveHoverTooltipShortcutKeyLabel('Mod', true)).toBe('Cmd');
	});
});
