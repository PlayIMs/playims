/*
Brief description:
This file verifies the shared slug helpers that normalize dashboard names into stable slugs.

Deeper explanation:
Slug regressions are easy to reintroduce because the same helpers are reused for initial slug creation,
live typing cleanup, and browser-style input mutation. If separator handling or cursor math changes,
multiple screens can start generating different slugs for the same name. These tests lock down the
shared contract directly so future refactors have to preserve the real behavior.

Summary of tests:
1. It verifies that every configured separator character becomes a hyphen in final slugs.
2. It verifies that quotes are removed, repeated separators collapse, and slug edges are trimmed.
3. It verifies that live slug typing keeps cursor positions stable while special separators normalize.
4. It verifies that input-like elements are updated in place with the normalized slug and cursor.
*/

import { describe, expect, it } from 'vitest';
import {
	applyLiveSlugInput,
	slugifyFinal,
	slugifyLiveWithCursor
} from '../../src/lib/components/wizard/slug-utils';

interface FakeSlugInput {
	value: string;
	selectionStart: number | null;
	selectionEnd: number | null;
	setSelectionRange: (start: number, end: number) => void;
}

describe('slug utils', () => {
	it('treats slash, ampersand, plus, underscore, pipe, and backslash as separators', () => {
		// these examples cover each separator individually and in combination so a future change
		// cannot quietly drop one character class from the normalization rules.
		expect(slugifyFinal('Fri/Wed 5pm')).toBe('fri-wed-5pm');
		expect(slugifyFinal('A&B+C_D|E\\F')).toBe('a-b-c-d-e-f');
		expect(slugifyFinal('North/South & East+West_Indoor|Outdoor\\Late')).toBe(
			'north-south-east-west-indoor-outdoor-late'
		);
	});

	it('removes quotes, collapses repeated separators, and trims slug edges consistently', () => {
		// this mixed case protects the full cleanup pipeline instead of only one punctuation rule
		// at a time, which makes refactors prove that the final slug stays canonical.
		expect(slugifyFinal(`  "Fri///Wed" &&& 5pm___Late ||| \\ Court  `)).toBe(
			'fri-wed-5pm-late-court'
		);

		// a slug made of only separators should collapse all the way down to an empty string.
		expect(slugifyFinal('___///&&&+++|||\\\\')).toBe('');

		// surrounding spaces and mixed separators should still produce clean word boundaries.
		expect(slugifyFinal('Rec / Intermediate + Competitive')).toBe(
			'rec-intermediate-competitive'
		);
	});

	it('keeps live slug cursor math stable when special separators become hyphens', () => {
		// this end-of-string case proves the final cursor lands at the visible end after cleanup.
		expect(slugifyLiveWithCursor('Fri/Wed 5pm', 'Fri/Wed 5pm'.length)).toEqual({
			value: 'fri-wed-5pm',
			cursor: 'fri-wed-5pm'.length
		});

		// this cursor sits on a separator boundary, so the test proves the caret does not jump
		// forward or backward unexpectedly when one separator becomes one hyphen.
		expect(slugifyLiveWithCursor('A&B', 2)).toEqual({
			value: 'a-b',
			cursor: 2
		});

		// repeated separators collapse into one hyphen, so the cursor should contract with them.
		expect(slugifyLiveWithCursor('A__B', 3)).toEqual({
			value: 'a-b',
			cursor: 2
		});

		// leading junk should disappear entirely, and the cursor should move to the new visible end.
		expect(slugifyLiveWithCursor(' / Fri', 6)).toEqual({
			value: 'fri',
			cursor: 3
		});

		// this mixed separator case proves the cursor stays stable in the middle of a longer slug.
		expect(slugifyLiveWithCursor('North|South\\East', 11)).toEqual({
			value: 'north-south-east',
			cursor: 11
		});
	});

	it('updates input-like elements in place with the normalized slug and cursor position', () => {
		// this fake input mirrors the browser fields used by the real helper without needing jsdom.
		const fakeInput: FakeSlugInput = {
			value: 'Fri/Wed 5pm',
			selectionStart: 11,
			selectionEnd: 11,
			setSelectionRange(start: number, end: number) {
				fakeInput.selectionStart = start;
				fakeInput.selectionEnd = end;
			}
		};

		// the helper should return the cleaned value and mutate the input state in the same pass.
		const value = applyLiveSlugInput(fakeInput as unknown as HTMLInputElement);

		expect(value).toBe('fri-wed-5pm');
		expect(fakeInput.value).toBe('fri-wed-5pm');
		expect(fakeInput.selectionStart).toBe('fri-wed-5pm'.length);
		expect(fakeInput.selectionEnd).toBe('fri-wed-5pm'.length);
	});
});
