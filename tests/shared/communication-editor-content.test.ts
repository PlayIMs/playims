/*
Brief description:
This file verifies communication editor content initialization rules.

Deeper explanation:
The communication composer can hydrate from stored HTML, stored editor JSON, or an empty draft.
These tests protect the normalization helpers that decide which persisted value should seed the rich
text editor so refactors do not silently drop draft content or replace a saved document with a blank
state.

Summary of tests:
1. It verifies that stored editor JSON wins when both JSON and HTML are available.
2. It verifies that stored HTML is used when editor JSON is missing.
3. It verifies that empty inputs still fall back to the editor's default empty paragraph.
*/

import { describe, expect, it } from 'vitest';

import {
	COMMUNICATION_EDITOR_EMPTY_HTML,
	getCommunicationEditorInitialContent
} from '../../src/lib/communications/editor-content';

describe('communication editor content', () => {
	it('prefers stored editor json over html when both are present', () => {
		// json is the richer source of truth because it preserves the editor document structure directly.
		expect(
			getCommunicationEditorInitialContent({
				initialHtml: '<p>hello</p>',
				initialJson: { type: 'doc', content: [{ type: 'paragraph' }] }
			})
		).toEqual({
			type: 'doc',
			content: [{ type: 'paragraph' }]
		});
	});

	it('falls back to stored html when json is missing', () => {
		// html keeps existing drafts editable even when an older record does not include json.
		expect(
			getCommunicationEditorInitialContent({
				initialHtml: '<p>league update</p>',
				initialJson: null
			})
		).toBe('<p>league update</p>');
	});

	it('returns the empty paragraph fallback for blank content', () => {
		// tiptap expects a minimal paragraph so the editor stays focusable and ready to type into.
		expect(
			getCommunicationEditorInitialContent({
				initialHtml: '',
				initialJson: null
			})
		).toBe(COMMUNICATION_EDITOR_EMPTY_HTML);
	});
});
