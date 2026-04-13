/*
Brief description:
This file verifies communication editor runtime state updates.

Deeper explanation:
The communications rich-text editor keeps one long-lived TipTap editor instance while its internal
selection and transaction state changes frequently. These tests protect the small runtime helper that
updates Svelte-facing editor state, so toolbar refreshes can happen without reassigning the same
editor instance over and over and accidentally creating reactive loops.

Summary of tests:
1. It verifies that the same editor instance keeps its identity while still bumping toolbar revision.
2. It verifies that a new editor instance replaces the previous instance.
3. It verifies that callers can skip a revision bump when they only need to replace the stored editor.
*/

import { describe, expect, it } from 'vitest';

import { updateCommunicationEditorRuntimeState } from '../../src/lib/communications/editor-runtime';

describe('communication editor runtime state', () => {
	it('keeps the same editor identity for mutable in-place updates', () => {
		// tiptap mutates one editor instance, so toolbar refreshes should not pretend the instance changed.
		const editor = { id: 'editor-1' };

		expect(
			updateCommunicationEditorRuntimeState(
				{
					editor,
					toolbarRevision: 4
				},
				editor
			)
		).toEqual({
			editor,
			toolbarRevision: 5
		});
	});

	it('replaces the stored editor when a new instance is mounted', () => {
		// a fresh editor mount should replace the previous instance so the component follows the real editor.
		const previousEditor = { id: 'editor-1' };
		const nextEditor = { id: 'editor-2' };

		expect(
			updateCommunicationEditorRuntimeState(
				{
					editor: previousEditor,
					toolbarRevision: 8
				},
				nextEditor
			)
		).toEqual({
			editor: nextEditor,
			toolbarRevision: 9
		});
	});

	it('supports replacing the editor without bumping toolbar revision', () => {
		// destroy/teardown paths sometimes need to clear the editor without signaling a toolbar refresh.
		expect(
			updateCommunicationEditorRuntimeState(
				{
					editor: { id: 'editor-1' },
					toolbarRevision: 3
				},
				null,
				{ bumpRevision: false }
			)
		).toEqual({
			editor: null,
			toolbarRevision: 3
		});
	});
});
