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
4. It verifies that the draft-state signature only changes when meaningful draft content changes.
5. It verifies that manual recipients are part of the draft-state signature.
*/

import { describe, expect, it } from 'vitest';

import {
	buildCommunicationDraftStateSignature,
	buildCommunicationEditorPayloadSignature,
	COMMUNICATION_EDITOR_EMPTY_HTML,
	buildCommunicationEditorContentSignature,
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

	it('builds the same signature for emitted payloads and incoming props', () => {
		// matching signatures prevent the controlled editor from reloading the same content it just emitted.
		const json = {
			type: 'doc',
			content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hello' }] }]
		};
		const html = '<h1>Hello</h1>';

		expect(
			buildCommunicationEditorPayloadSignature({
				html,
				json
			})
		).toBe(
			buildCommunicationEditorContentSignature({
				initialHtml: html,
				initialJson: json
			})
		);
	});

	it('normalizes draft state signatures for unsaved-change guards', () => {
		// trimming harmless whitespace keeps the page guard focused on real draft edits, not cosmetic noise.
		const recipientGroups = [
			{
				id: 'recipient-group-1',
				mode: 'include',
				filters: { teamId: 'team-1' }
			}
		];

		expect(
			buildCommunicationDraftStateSignature({
				subject: ' League update ',
				html: '<p>Hello</p> ',
				json: { type: 'doc', content: [{ type: 'paragraph' }] },
				recipientGroups
			})
		).toBe(
			buildCommunicationDraftStateSignature({
				subject: 'League update',
				html: '<p>Hello</p>',
				json: { type: 'doc', content: [{ type: 'paragraph' }] },
				recipientGroups
			})
		);

		expect(
			buildCommunicationDraftStateSignature({
				subject: 'League update',
				html: '<p>Hello</p>',
				json: { type: 'doc', content: [{ type: 'paragraph' }] },
				recipientGroups,
				manualRecipients: [
					{
						userId: 'user-1',
						email: 'alex@playims.test',
						fullName: 'Alex Captain'
					}
				]
			})
		).not.toBe(
			buildCommunicationDraftStateSignature({
				subject: 'League update',
				html: '<p>Hello again</p>',
				json: { type: 'doc', content: [{ type: 'paragraph' }] },
				recipientGroups,
				manualRecipients: [
					{
						userId: 'user-1',
						email: 'alex@playims.test',
						fullName: 'Alex Captain'
					}
				]
			})
		);
	});

	it('treats manual recipient changes as real draft edits', () => {
		// manual recipients are part of the saved audience contract, so the unsaved guard must include them.
		expect(
			buildCommunicationDraftStateSignature({
				subject: 'League update',
				html: '<p>Hello</p>',
				json: { type: 'doc', content: [{ type: 'paragraph' }] },
				recipientGroups: [],
				manualRecipients: [
					{
						userId: 'user-1',
						email: 'alex@playims.test',
						fullName: 'Alex Captain'
					}
				]
			})
		).not.toBe(
			buildCommunicationDraftStateSignature({
				subject: 'League update',
				html: '<p>Hello</p>',
				json: { type: 'doc', content: [{ type: 'paragraph' }] },
				recipientGroups: [],
				manualRecipients: [
					{
						userId: 'user-2',
						email: 'jamie@playims.test',
						fullName: 'Jamie Player'
					}
				]
			})
		);
	});
});
