/*
Brief description:
This file protects the shared ownership of modal and wizard framing.

Deeper explanation:
These integration contracts verify that the live Svelte wrappers use the shared header, panel,
and footer classes. They prevent a future instance from silently copying the base appearance.
Keyboard behavior is tested separately and still needs browser verification.

Summary of tests:
1. It verifies that ordinary modals and wizards use the same header component.
2. It verifies that panel styling is always inherited, even with custom layout classes.
3. It verifies that wizard footers live outside the scrollable body but inside the form.
4. It verifies that live wrappers invoke shared helpers and preserve inherited dropdown appearance.
*/
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shell = readFileSync('src/lib/components/modals/ModalShell.svelte', 'utf8');
const wizard = readFileSync('src/lib/components/wizard/WizardModal.svelte', 'utf8');

describe('shared modal architecture', () => {
	it('shares the header instead of copying its close button', () => {
		expect(shell).toContain('<ModalHeader');
		expect(wizard).toContain('<ModalHeader');
		expect(wizard).not.toContain('<IconX');
	});
	it('always includes the base panel class', () => {
		// layout overrides must not remove the base border, background, or viewport cap.
		expect(shell).toContain('modal-panel ${panelClass}');
		expect(wizard).not.toContain('border-[3px]');
	});
	it('keeps footer actions outside the scrolling body', () => {
		// remaining inside the form preserves native submit buttons and keyboard saving.
		expect(wizard).toMatch(
			/<div class=\{`modal-body \$\{formClass\}`\}>[\s\S]*?<\/div>\s*\{#if footer\}/
		);
		expect(wizard).toContain('class="modal-footer"');
	});
	it('wires focus and enter behavior through the tested shared helper', () => {
		// helper tests are insufficient unless the live wrapper actually invokes them.
		expect(wizard).toContain('findWizardFocusTarget(formElement)');
		expect(wizard).toContain('shouldSubmitWizardForm(event.currentTarget)');
		expect(shell).toContain('setContext(MODAL_UI_CONTEXT, true)');
		const listbox = readFileSync('src/lib/components/ListboxDropdown.svelte', 'utf8');
		expect(listbox).toContain('resolveListboxVariant(variant, inModal, mode, buttonClass)');
	});
});
