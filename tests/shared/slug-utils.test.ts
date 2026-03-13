// brief header:
// These tests lock down the shared slug utility that powers live slug inputs across the dashboard.
//
// deeper explanation:
// Slug bugs are easy to reintroduce because the UI uses the same helper in several different ways:
// initial auto-generation, live input cleanup while a user types, duplicate checks, and revert-to-default
// affordances. If one character class changes or cursor handling regresses, multiple pages can silently
// start generating mismatched slugs. This suite focuses on the shared utility directly so future refactors
// have to preserve the real contract instead of only keeping one page "mostly working".
//
// summary of the tests below:
// 1. Confirms all configured separator characters normalize to hyphens in final slugs.
// 2. Confirms mixed punctuation still collapses into one stable canonical slug.
// 3. Confirms live slug typing keeps cursor positions sensible while converting separators.
// 4. Confirms applyLiveSlugInput mutates an input-like element the same way the browser field expects.

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
		expect(slugifyFinal('Fri/Wed 5pm')).toBe('fri-wed-5pm');
		expect(slugifyFinal('A&B+C_D|E\\F')).toBe('a-b-c-d-e-f');
		expect(slugifyFinal('North/South & East+West_Indoor|Outdoor\\Late')).toBe(
			'north-south-east-west-indoor-outdoor-late'
		);
	});

	it('removes quotes, collapses repeated separators, and trims slug edges consistently', () => {
		expect(slugifyFinal(`  "Fri///Wed" &&& 5pm___Late ||| \\ Court  `)).toBe(
			'fri-wed-5pm-late-court'
		);
		expect(slugifyFinal('___///&&&+++|||\\\\')).toBe('');
		expect(slugifyFinal('Rec / Intermediate + Competitive')).toBe(
			'rec-intermediate-competitive'
		);
	});

	it('keeps live slug cursor math stable when special separators become hyphens', () => {
		expect(slugifyLiveWithCursor('Fri/Wed 5pm', 'Fri/Wed 5pm'.length)).toEqual({
			value: 'fri-wed-5pm',
			cursor: 'fri-wed-5pm'.length
		});

		expect(slugifyLiveWithCursor('A&B', 2)).toEqual({
			value: 'a-b',
			cursor: 2
		});

		expect(slugifyLiveWithCursor('A__B', 3)).toEqual({
			value: 'a-b',
			cursor: 2
		});

		expect(slugifyLiveWithCursor(' / Fri', 6)).toEqual({
			value: 'fri',
			cursor: 3
		});

		expect(slugifyLiveWithCursor('North|South\\East', 11)).toEqual({
			value: 'north-south-east',
			cursor: 11
		});
	});

	it('updates input-like elements in place with the normalized slug and cursor position', () => {
		const fakeInput: FakeSlugInput = {
			value: 'Fri/Wed 5pm',
			selectionStart: 11,
			selectionEnd: 11,
			setSelectionRange(start: number, end: number) {
				fakeInput.selectionStart = start;
				fakeInput.selectionEnd = end;
			}
		};

		const value = applyLiveSlugInput(fakeInput as unknown as HTMLInputElement);

		expect(value).toBe('fri-wed-5pm');
		expect(fakeInput.value).toBe('fri-wed-5pm');
		expect(fakeInput.selectionStart).toBe('fri-wed-5pm'.length);
		expect(fakeInput.selectionEnd).toBe('fri-wed-5pm'.length);
	});
});
