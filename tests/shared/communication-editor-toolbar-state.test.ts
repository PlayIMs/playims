/*
Brief description:
This file verifies communication editor toolbar-state snapshots for active formatting and list styles.

Deeper explanation:
The communications rich-text editor uses TipTap, which keeps selection and mark state inside a mutable
editor instance. These tests protect the derived toolbar snapshot that converts that mutable editor
state into plain values the Svelte UI can reliably render, so toolbar buttons stop appearing "stuck"
after formatting is toggled off or the cursor moves into a different block.

Summary of tests:
1. It verifies that active inline formatting and block types are read from the current editor state.
2. It verifies that list style attributes and active states update when the same editor instance changes.
3. It verifies that font family and font size are normalized from text-style attributes.
*/

import { describe, expect, it } from 'vitest';

import { getCommunicationEditorToolbarState } from '../../src/lib/communications/editor-toolbar-state';

describe('communication editor toolbar state', () => {
	it('reads the current inline and block formatting state', () => {
		// the toolbar should mirror whatever formatting is active at the current cursor position.
		const active = new Map<string, boolean>([
			['bold', true],
			['italic', false],
			['underline', true],
			['strike', false],
			['link', false],
			['blockquote', true],
			['bulletList', false],
			['orderedList', false],
			['image', false],
			['table', false],
			['heading:2', true]
		]);

		const editor = {
			isActive: (name: string, attributes?: Record<string, unknown>) => {
				if (name === 'heading' && attributes?.level) {
					return active.get(`heading:${attributes.level}`) ?? false;
				}

				return active.get(name) ?? false;
			},
			getAttributes: () => ({})
		};

		expect(getCommunicationEditorToolbarState(editor)).toMatchObject({
			textBlockStyle: 'heading-2',
			bold: true,
			underline: true,
			blockquote: true,
			bulletList: false,
			orderedList: false
		});
	});

	it('updates list states and styles when the same editor instance changes', () => {
		// the editor object is mutable, so the snapshot must reflect its newest internal state each time.
		const active = new Map<string, boolean>([
			['bulletList', true],
			['orderedList', false]
		]);
		const attributes = {
			bulletList: { listStyleType: 'circle' },
			orderedList: { listStyleType: 'decimal' }
		};

		const editor = {
			isActive: (name: string) => active.get(name) ?? false,
			getAttributes: (name: string) => attributes[name as keyof typeof attributes] ?? {}
		};

		expect(getCommunicationEditorToolbarState(editor)).toMatchObject({
			bulletList: true,
			bulletListStyle: 'circle',
			orderedList: false,
			orderedListStyle: 'decimal'
		});

		// this mirrors the bug case where the user toggles a list off or moves the cursor elsewhere.
		active.set('bulletList', false);
		active.set('orderedList', true);
		attributes.bulletList = { listStyleType: 'disc' };
		attributes.orderedList = { listStyleType: 'lower-alpha' };

		expect(getCommunicationEditorToolbarState(editor)).toMatchObject({
			bulletList: false,
			bulletListStyle: 'disc',
			orderedList: true,
			orderedListStyle: 'lower-alpha'
		});
	});

	it('normalizes font family and font size from text style attributes', () => {
		// toolbar typography controls should reflect the current cursor position in editor-friendly values.
		const editor = {
			isActive: () => false,
			getAttributes: (name: string) => {
				if (name === 'textStyle') {
					return {
						fontFamily: 'Bitter, serif',
						fontSize: '22px'
					};
				}

				return {};
			}
		};

		expect(getCommunicationEditorToolbarState(editor)).toMatchObject({
			fontFamily: 'bitter',
			fontSize: 22
		});
	});
});
