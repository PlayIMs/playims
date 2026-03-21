/*
Brief description:
This file verifies the shared keyboard shortcut guard used by save-only modals and wizards.

Deeper explanation:
The modal shells now support an opt-in Ctrl/Cmd+S shortcut for save-only flows. These tests protect
the common shortcut rules in one small place so future modal refactors do not accidentally start
submitting on plain "s", Shift+Ctrl+S, Alt combinations, or already-consumed key events.

Summary of tests:
1. It verifies that Ctrl+S and Cmd+S are treated as valid save shortcuts.
2. It verifies that plain keys and modified non-save combinations are rejected.
3. It verifies that already-prevented key events do not trigger another save shortcut.
*/

import { describe, expect, it } from 'vitest';

import { isSaveShortcutEvent } from '../../src/lib/components/modals/save-shortcut';

describe('save shortcut helper', () => {
	it('accepts both ctrl+s and cmd+s', () => {
		// windows and mac users should both get the same save behavior.
		expect(
			isSaveShortcutEvent({
				key: 's',
				ctrlKey: true,
				metaKey: false,
				altKey: false,
				shiftKey: false
			})
		).toBe(true);
		expect(
			isSaveShortcutEvent({
				key: 'S',
				ctrlKey: false,
				metaKey: true,
				altKey: false,
				shiftKey: false
			})
		).toBe(true);
	});

	it('rejects plain or mismatched modified keys', () => {
		// only the intentional save shortcut should submit a save-only modal.
		expect(
			isSaveShortcutEvent({
				key: 's',
				ctrlKey: false,
				metaKey: false,
				altKey: false,
				shiftKey: false
			})
		).toBe(false);
		expect(
			isSaveShortcutEvent({
				key: 's',
				ctrlKey: true,
				metaKey: false,
				altKey: true,
				shiftKey: false
			})
		).toBe(false);
		expect(
			isSaveShortcutEvent({
				key: 's',
				ctrlKey: true,
				metaKey: false,
				altKey: false,
				shiftKey: true
			})
		).toBe(false);
	});

	it('ignores save shortcuts that another handler already consumed', () => {
		// modal shells should not fight with any earlier handler that already prevented the event.
		expect(
			isSaveShortcutEvent({
				key: 's',
				ctrlKey: true,
				metaKey: false,
				altKey: false,
				shiftKey: false,
				defaultPrevented: true
			})
		).toBe(false);
	});
});
