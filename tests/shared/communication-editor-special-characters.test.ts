/*
Brief description:
This file verifies the curated special character catalog used by the communications rich-text editor.

Deeper explanation:
The editor now offers a modal picker for common symbols that are not directly available on a standard
keyboard. These tests protect the helper list so the picker keeps the intended size, does not drift
into duplicate entries, and continues exposing accessible labels that explain what each symbol means.

Summary of tests:
1. It verifies that the picker catalog contains exactly 44 curated entries.
2. It verifies that the picker order matches the requested list exactly.
3. It verifies that each special character is unique and has a readable label and search text.
*/

import { describe, expect, it } from 'vitest';

import {
	communicationEditorSpecialCharacters,
	getCommunicationEditorSpecialCharacter
} from '../../src/lib/communications/editor-special-characters';

describe('communication editor special character catalog', () => {
	it('contains exactly 44 curated special characters', () => {
		// the product request was for a fixed-size common-character picker, so the count matters.
		expect(communicationEditorSpecialCharacters).toHaveLength(44);
	});

	it('keeps the characters in the requested order', () => {
		// order matters here because the picker is a visual reference list, not just a search catalog.
		expect(communicationEditorSpecialCharacters.map((option) => option.value)).toEqual([
			'—',
			'–',
			'…',
			'•',
			'†',
			'‡',
			'¶',
			'§',
			'©',
			'®',
			'™',
			'€',
			'£',
			'¥',
			'¢',
			'½',
			'⅓',
			'¼',
			'¾',
			'°',
			'✓',
			'ñ',
			'ü',
			'ç',
			'à',
			'é',
			'±',
			'×',
			'÷',
			'≠',
			'≈',
			'≤',
			'≥',
			'∞',
			'π',
			'√',
			'∑',
			'→',
			'←',
			'↑',
			'↓',
			'«',
			'»',
			'‰'
		]);
	});

	it('keeps each character unique with accessible metadata', () => {
		// uniqueness prevents visually duplicated buttons that would confuse users.
		const values = communicationEditorSpecialCharacters.map((option) => option.value);
		expect(new Set(values).size).toBe(values.length);

		// readable labels and search text make the picker understandable to both users and future maintainers.
		for (const option of communicationEditorSpecialCharacters) {
			expect(option.label.trim().length).toBeGreaterThan(0);
			expect(option.searchText.trim().length).toBeGreaterThan(0);
			expect(getCommunicationEditorSpecialCharacter(option.value)).toEqual(option);
		}
	});
});
