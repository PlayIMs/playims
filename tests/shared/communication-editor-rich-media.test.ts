/*
Brief description:
This file verifies communication editor media helper behavior for image URLs and table insertion.

Deeper explanation:
The richer communications composer will support image insertion by URL and basic table creation.
These tests protect the small normalization helpers that prepare those actions so the toolbar logic
can stay thin while still rejecting unsafe image sources, fixing common user input, and keeping
table dimensions inside a practical range for newsletter-style content.

Summary of tests:
1. It verifies that image URLs are trimmed and normalized to secure absolute URLs when possible.
2. It verifies that unsupported or unsafe image URL schemes are rejected.
3. It verifies that table insertion dimensions are clamped to a practical supported range.
4. It verifies that drag-and-drop helpers recognize image files by MIME type.
*/

import { describe, expect, it } from 'vitest';

import {
	buildCommunicationEditorTableConfig,
	isCommunicationEditorImageFile,
	normalizeCommunicationEditorImageAttributes
} from '../../src/lib/communications/editor-rich-media';

describe('communication editor rich media helpers', () => {
	it('normalizes image urls and trims optional metadata', () => {
		// newsletter editors often receive pasted hostnames without a protocol, so we normalize them.
		expect(
			normalizeCommunicationEditorImageAttributes({
				src: '  cdn.playims.com/banner.png  ',
				alt: '  season banner  ',
				title: '  Spring 2026  '
			})
		).toEqual({
			src: 'https://cdn.playims.com/banner.png',
			alt: 'season banner',
			title: 'Spring 2026'
		});

		// already-valid secure urls should pass through without being rewritten unnecessarily.
		expect(
			normalizeCommunicationEditorImageAttributes({
				src: 'https://images.example.com/photo.jpg',
				alt: '',
				title: ' '
			})
		).toEqual({
			src: 'https://images.example.com/photo.jpg',
			alt: undefined,
			title: undefined
		});
	});

	it('rejects empty or unsafe image urls', () => {
		// image insertion is url-based for now, so only safe remote urls should be accepted.
		expect(
			normalizeCommunicationEditorImageAttributes({
				src: '   ',
				alt: '',
				title: ''
			})
		).toBeNull();
		expect(
			normalizeCommunicationEditorImageAttributes({
				src: 'javascript:alert(1)',
				alt: 'x',
				title: 'y'
			})
		).toBeNull();
		expect(
			normalizeCommunicationEditorImageAttributes({
				src: 'data:image/png;base64,abc123',
				alt: 'inline',
				title: 'inline'
			})
		).toBeNull();
	});

	it('recognizes image mime types for dropped or pasted files', () => {
		// the editor should only intercept pasted or dropped files when they are actual images.
		expect(isCommunicationEditorImageFile({ type: 'image/png' })).toBe(true);
		expect(isCommunicationEditorImageFile({ type: ' IMAGE/JPEG ' })).toBe(true);

		// non-image files should fall back to normal editor/browser behavior.
		expect(isCommunicationEditorImageFile({ type: 'application/pdf' })).toBe(false);
		expect(isCommunicationEditorImageFile({ type: '' })).toBe(false);
		expect(isCommunicationEditorImageFile(null)).toBe(false);
	});

	it('clamps table dimensions and preserves the header-row choice', () => {
		// practical limits keep the quick-insert dialog useful without turning into a spreadsheet builder.
		expect(
			buildCommunicationEditorTableConfig({
				rows: 0,
				cols: 99,
				withHeaderRow: false
			})
		).toEqual({
			rows: 1,
			cols: 8,
			withHeaderRow: false
		});

		// already-valid values should be kept so the dialog feels predictable to the user.
		expect(
			buildCommunicationEditorTableConfig({
				rows: 3,
				cols: 4,
				withHeaderRow: true
			})
		).toEqual({
			rows: 3,
			cols: 4,
			withHeaderRow: true
		});
	});
});
