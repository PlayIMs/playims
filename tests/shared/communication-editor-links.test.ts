/*
Brief description:
This file verifies the pure helper logic that powers the communication editor hyperlink modal.

Deeper explanation:
The hyperlink modal now needs to do more than store a URL. It also defaults the display text from
the current editor selection, preserves whether an existing link should open in a new tab, and
builds consistent link attributes when the user applies changes. These tests protect that small
decision layer so future modal or TipTap refactors do not quietly regress link editing behavior.

Summary of tests:
1. It verifies that the dialog state defaults the text field from the selected editor text.
2. It verifies that the dialog state preserves whether an existing link opens in a new tab.
3. It verifies that applying a new-tab link returns the expected target and rel attributes.
4. It verifies that display text falls back to the current URL when the user leaves the text blank.
*/

import { describe, expect, it } from 'vitest';

import {
	buildCommunicationEditorLinkAttributes,
	buildCommunicationEditorLinkDialogState,
	resolveCommunicationEditorLinkDisplayText
} from '../../src/lib/communications/editor-links';

describe('communication editor link helpers', () => {
	it('defaults the dialog text field from the selected editor text', () => {
		// selected text is the most user-friendly default because it reflects what will become the link label.
		expect(
			buildCommunicationEditorLinkDialogState({
				selectedText: 'Playoffs Bracket',
				currentHref: 'https://example.com/bracket',
				currentTarget: null
			})
		).toEqual({
			url: 'https://example.com/bracket',
			text: 'Playoffs Bracket',
			openInNewTab: false
		});
	});

	it('preserves new-tab state when editing an existing link', () => {
		// existing links should reopen with their current target behavior instead of silently resetting it.
		expect(
			buildCommunicationEditorLinkDialogState({
				selectedText: 'Team Registration',
				currentHref: 'https://example.com/register',
				currentTarget: '_blank'
			})
		).toEqual({
			url: 'https://example.com/register',
			text: 'Team Registration',
			openInNewTab: true
		});
	});

	it('builds the expected target and rel attributes for new-tab links', () => {
		// rel should travel with target blank so external links stay safe when opened in a new tab.
		expect(
			buildCommunicationEditorLinkAttributes({
				href: 'https://example.com/register',
				openInNewTab: true
			})
		).toEqual({
			href: 'https://example.com/register',
			target: '_blank',
			rel: 'noopener noreferrer'
		});
	});

	it('falls back to the current url when the user leaves display text blank', () => {
		// a new link should still get visible text even when the user opens the modal from a collapsed cursor.
		expect(
			resolveCommunicationEditorLinkDisplayText({
				text: '   ',
				selectedText: '',
				url: 'https://example.com/register'
			})
		).toBe('https://example.com/register');
	});
});
