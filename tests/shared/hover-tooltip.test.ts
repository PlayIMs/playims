/*
Brief description:
This file verifies the shared hover tooltip dismissal helpers and shortcut-key formatting rules.

Deeper explanation:
The tooltip component follows the cursor and renders from a body portal, which means it can stay
visible if the browser window loses the pointer before the trigger receives its normal leave event.
The same shared helper layer also normalizes tooltip keycaps, so these tests protect both dismissal
behavior and the source-of-truth keyboard-shortcut formatting.

Summary of tests:
1. It verifies that a window mouseout with no related target hides the tooltip.
2. It verifies that moving between in-window targets does not hide the tooltip.
3. It verifies that hidden document visibility states dismiss the tooltip.
4. It verifies that the visible document state keeps the tooltip available.
5. It verifies that alt-style shortcut labels become opt on mac and alt on other platforms.
6. It verifies that mod-style shortcut labels still map to cmd or ctrl.
7. It verifies that arrow-style shortcut labels resolve to the shared heavy-arrow descriptor.
8. It verifies that multi-row tooltip content normalizes text and shortcut labels safely.
*/

import { describe, expect, it } from 'vitest';
import {
	HEAVY_ROUND_TIPPED_RIGHT_ARROW,
	normalizeHoverTooltipRows,
	resolveHoverTooltipShortcutKeyLabel,
	shouldHideHoverTooltipOnVisibilityChange,
	shouldHideHoverTooltipOnWindowMouseOut
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
		expect(resolveHoverTooltipShortcutKeyLabel('Alt', false)).toEqual({
			label: 'Alt',
			visualLabel: 'Alt'
		});
		expect(resolveHoverTooltipShortcutKeyLabel('Alt', true)).toEqual({
			label: 'Opt',
			visualLabel: 'Opt'
		});
		expect(resolveHoverTooltipShortcutKeyLabel('Option', true)).toEqual({
			label: 'Opt',
			visualLabel: 'Opt'
		});
	});

	it('continues mapping mod labels to cmd or ctrl', () => {
		// the shared tooltip still needs to render the common command key pairing correctly.
		expect(resolveHoverTooltipShortcutKeyLabel('Mod', false)).toEqual({
			label: 'Ctrl',
			visualLabel: 'Ctrl'
		});
		expect(resolveHoverTooltipShortcutKeyLabel('Mod', true)).toEqual({
			label: 'Cmd',
			visualLabel: 'Cmd'
		});
	});

	it('resolves arrow shortcut labels to the shared heavy-arrow descriptor', () => {
		// using one canonical glyph plus rotation keeps every tooltip keycap visually consistent.
		expect(resolveHoverTooltipShortcutKeyLabel('Left Arrow', false)).toEqual({
			label: 'Left Arrow',
			visualLabel: HEAVY_ROUND_TIPPED_RIGHT_ARROW,
			rotationDegrees: 180
		});
		expect(resolveHoverTooltipShortcutKeyLabel('ArrowRight', false)).toEqual({
			label: 'Right Arrow',
			visualLabel: HEAVY_ROUND_TIPPED_RIGHT_ARROW,
			rotationDegrees: 0
		});
		expect(resolveHoverTooltipShortcutKeyLabel('Up Arrow', true)).toEqual({
			label: 'Up Arrow',
			visualLabel: HEAVY_ROUND_TIPPED_RIGHT_ARROW,
			rotationDegrees: -90
		});
		expect(resolveHoverTooltipShortcutKeyLabel('ArrowDown', true)).toEqual({
			label: 'Down Arrow',
			visualLabel: HEAVY_ROUND_TIPPED_RIGHT_ARROW,
			rotationDegrees: 90
		});
	});

	it('normalizes multi-row tooltip content and shortcut labels', () => {
		// this lets one tooltip show separate action rows without leaking blank text or platform-inconsistent key labels.
		expect(
			normalizeHoverTooltipRows(
				[
					{ text: 'Previous Day', shortcutKeys: ['Left Arrow'] },
					{ text: 'Previous Week', shortcutKeys: ['Shift', 'Left Arrow'] },
					{ text: '   ', shortcutKeys: [] }
				],
				false
			)
		).toEqual([
			{
				text: 'Previous Day',
				shortcutKeys: [
					{
						label: 'Left Arrow',
						visualLabel: HEAVY_ROUND_TIPPED_RIGHT_ARROW,
						rotationDegrees: 180
					}
				]
			},
			{
				text: 'Previous Week',
				shortcutKeys: [
					{ label: 'Shift', visualLabel: 'Shift' },
					{
						label: 'Left Arrow',
						visualLabel: HEAVY_ROUND_TIPPED_RIGHT_ARROW,
						rotationDegrees: 180
					}
				]
			}
		]);
	});
});
