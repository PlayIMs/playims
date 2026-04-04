/*
Brief description:
This file verifies communication editor editable-target detection.

Deeper explanation:
The communication composer now relies on TipTap's built-in keyboard shortcut system, but the
dashboard shell still needs one local rule: when focus is inside the editor, global shortcuts like
the sidebar toggle must back off. These tests keep that focus-detection contract stable for both
contenteditable surfaces and normal form controls embedded in the editor chrome.

Summary of tests:
1. It verifies that editable input and rich-text targets are detected as editor-owned surfaces.
2. It verifies that non-editable button-like targets do not block dashboard shortcuts.
*/

import { describe, expect, it } from 'vitest';

import { isCommunicationEditorEditableTarget } from '../../src/lib/communications/editor-shortcuts';

describe('communication editor shortcuts', () => {
	it('treats contenteditable and input-like targets as editor-owned surfaces', () => {
		// the sidebar shortcut should back off when focus is inside an editable draft surface.
		expect(
			isCommunicationEditorEditableTarget({
				tagName: 'DIV',
				isContentEditable: true,
				closest: () => null
			})
		).toBe(true);
		expect(
			isCommunicationEditorEditableTarget({
				tagName: 'INPUT',
				isContentEditable: false,
				closest: () => null
			})
		).toBe(true);
		expect(
			isCommunicationEditorEditableTarget({
				tagName: 'SPAN',
				isContentEditable: false,
				closest: (selector) => (selector === '[data-communication-editor-root]' ? {} : null)
			})
		).toBe(true);
	});

	it('leaves normal non-editable targets available to dashboard shortcuts', () => {
		// plain interactive chrome outside the editor should not suppress the sidebar toggle.
		expect(
			isCommunicationEditorEditableTarget({
				tagName: 'BUTTON',
				isContentEditable: false,
				closest: () => null
			})
		).toBe(false);
	});
});
