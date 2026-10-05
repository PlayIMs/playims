/*
Brief description:
This file protects stable validation-message spacing in modals and wizards.

Deeper explanation:
Field wrappers reserve a compact line even when no error exists. Messages occupy that reserved
space rather than participating in layout, so displaying validation cannot move adjacent inputs.

Summary of tests:
1. It verifies shared modal styling reserves space independently of error visibility.
2. It verifies date and time fields do not render a duplicate combined error below their grid.
3. It verifies focused fields hide errors without collapsing their reserved message space.
*/
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('stable modal field validation', () => {
	it('defers visible feedback while a shared or legacy field is being edited', () => {
		// visibility preserves the reserved line; display none would reintroduce layout movement.
		const css = readFileSync('src/app.css', 'utf8');
		expect(css).toContain('.modal-field:has(:is(input, textarea, select):focus)');
		expect(css).toContain(
			':has(> label, > div.flex > label):has(:is(input, textarea, select):focus)'
		);
	});
	it('reserves a single compact line and positions messages outside normal flow', () => {
		// the empty state must reserve space too; a conditional margin would still cause movement.
		const css = readFileSync('src/app.css', 'utf8');
		expect(css).toContain('--modal-field-message-height: 1rem');
		expect(css).toContain('padding-bottom: calc(var(--modal-field-message-height) + 0.125rem)');
		expect(css).toContain('.modal-field-error');
		expect(css).toContain('text-overflow: ellipsis');
	});
	it('delegates each split-field error to its own control', () => {
		const field = readFileSync('src/lib/components/DateTimeInput.svelte', 'utf8');
		expect(field).not.toContain('{#if error}<p');
		expect(field).toContain('error={dateError}');
		expect(field).toContain('error={timeError}');
	});
});
