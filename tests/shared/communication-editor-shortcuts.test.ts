/*
Brief description:
This file verifies communication editor shortcut resolution and editable-target detection.

Deeper explanation:
The communication composer now needs keyboard shortcuts that behave like a normal document editor
while also coexisting with dashboard-level shortcuts such as the sidebar toggle. These tests keep
the shortcut mapping stable and make sure rich-text/contenteditable targets are treated as editing
surfaces so global shortcuts can back off when the editor is focused.

Summary of tests:
1. It verifies that common formatting and history shortcuts resolve to the expected editor commands.
2. It verifies that unrelated key combinations do not resolve to communication editor commands.
3. It verifies that editable input and rich-text targets are detected as editor-owned surfaces.
4. It verifies that non-editable button-like targets do not block dashboard shortcuts.
*/

import { describe, expect, it } from 'vitest';

import {
	isCommunicationEditorEditableTarget,
	resolveCommunicationEditorShortcut
} from '../../src/lib/communications/editor-shortcuts';

describe('communication editor shortcuts', () => {
	it('maps common document shortcuts to editor commands', () => {
		// these combos mirror the baseline shortcuts users expect in a simple docs-style editor.
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				code: 'KeyB',
				key: 'b'
			})
		).toBe('bold');
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: false,
				metaKey: true,
				shiftKey: false,
				altKey: false,
				code: 'KeyI',
				key: 'i'
			})
		).toBe('italic');
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				code: 'KeyU',
				key: 'u'
			})
		).toBe('underline');
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				code: 'KeyK',
				key: 'k'
			})
		).toBe('link');
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: true,
				altKey: false,
				code: 'Digit8',
				key: '*'
			})
		).toBe('bulletList');
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: true,
				altKey: false,
				code: 'Digit7',
				key: '&'
			})
		).toBe('orderedList');
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				code: 'KeyZ',
				key: 'z'
			})
		).toBe('undo');
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: false,
				metaKey: true,
				shiftKey: true,
				altKey: false,
				code: 'KeyZ',
				key: 'z'
			})
		).toBe('redo');
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				code: 'KeyY',
				key: 'y'
			})
		).toBe('redo');
	});

	it('ignores unrelated or conflicting key combinations', () => {
		// the helper should stay quiet when the combo does not belong to the editor.
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: false,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				code: 'KeyB',
				key: 'b'
			})
		).toBeNull();
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				altKey: true,
				code: 'KeyB',
				key: 'b'
			})
		).toBeNull();
		expect(
			resolveCommunicationEditorShortcut({
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				altKey: false,
				code: 'KeyP',
				key: 'p'
			})
		).toBeNull();
	});

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
