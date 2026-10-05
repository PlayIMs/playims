/*
Brief description:
This file verifies shared modal keyboard boundaries.

Deeper explanation:
Nested controls must consume Escape before a modal closes. Tab should wrap at the modal edges,
including empty dialogs, so keyboard users cannot accidentally move behind the overlay.

Summary of tests:
1. It verifies forward and reverse focus wrapping, including empty dialogs.
2. It verifies consumed Escape events and active date pickers leave the modal open.
*/
import { describe, expect, it } from 'vitest';
import {
	getModalTabTarget,
	shouldCloseModalOnEscape
} from '../../src/lib/components/modals/modal-keyboard';

describe('modal keyboard boundaries', () => {
	it('wraps only at focus boundaries', () => {
		// null leaves normal tab movement alone; -1 means focus the panel when it has no controls.
		expect(getModalTabTarget(3, 2, false)).toBe(0);
		expect(getModalTabTarget(3, 0, true)).toBe(2);
		expect(getModalTabTarget(3, 1, false)).toBeNull();
		expect(getModalTabTarget(3, -1, false)).toBe(0);
		expect(getModalTabTarget(3, -1, true)).toBe(2);
		expect(getModalTabTarget(0, -1, false)).toBe(-1);
	});
	it('lets nested controls handle escape first', () => {
		// a dropdown or picker closing must not also close the form that contains it.
		expect(shouldCloseModalOnEscape('Escape', false, false)).toBe(true);
		expect(shouldCloseModalOnEscape('Escape', true, false)).toBe(false);
		expect(shouldCloseModalOnEscape('Escape', false, true)).toBe(false);
		expect(shouldCloseModalOnEscape('Enter', false, false)).toBe(false);
	});
});
