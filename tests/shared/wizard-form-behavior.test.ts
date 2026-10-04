/*
Brief description:
This file verifies shared wizard focus and form submission behavior.

Deeper explanation:
Custom dropdowns are form fields too. Autofocus should skip unavailable controls and include
dropdown triggers. Enter must follow the visible Next action instead of submitting an unfinished
wizard, and disabled final actions must block keyboard submission as well as mouse clicks.

Summary of tests:
1. It verifies preferred, unavailable, and dropdown autofocus targets.
2. It verifies that intermediate submission invokes Next without submitting the final mutation.
3. It verifies disabled actions and final-step submission.
4. It verifies that modifier keys, input composition, and non-text inputs do not advance a step.
*/
import { describe, expect, it, vi } from 'vitest';
import {
	findWizardFocusTarget,
	shouldSubmitWizardForm,
	shouldAdvanceWizardOnEnter
} from '../../src/lib/components/wizard/wizard-form-behavior';

function field(preferred = false, disabled = false, visible = true) {
	// small dom doubles keep the tests focused on selection rules rather than browser layout.
	return {
		tabIndex: 0,
		matches: () => disabled,
		closest: () => null,
		hasAttribute: () => preferred,
		getClientRects: () => (visible ? [{}] : [])
	} as unknown as HTMLElement;
}

describe('wizard form behavior', () => {
	it('advances only plain enter from text-like inputs', () => {
		// textarea, date-picker, modifier, and composition input must retain their own keyboard behavior.
		const event = {
			key: 'Enter',
			defaultPrevented: false,
			isComposing: false,
			ctrlKey: false,
			metaKey: false,
			altKey: false,
			shiftKey: false
		};
		expect(shouldAdvanceWizardOnEnter(event, 'text')).toBe(true);
		expect(shouldAdvanceWizardOnEnter(event, 'number')).toBe(true);
		expect(shouldAdvanceWizardOnEnter(event, 'date')).toBe(false);
		expect(shouldAdvanceWizardOnEnter(event, 'checkbox')).toBe(false);
		expect(shouldAdvanceWizardOnEnter({ ...event, isComposing: true }, 'text')).toBe(false);
		expect(shouldAdvanceWizardOnEnter({ ...event, defaultPrevented: true }, 'text')).toBe(false);
		expect(shouldAdvanceWizardOnEnter({ ...event, shiftKey: true }, 'text')).toBe(false);
	});
	it('prefers available marked fields and skips hidden or disabled fields', () => {
		const first = field();
		const preferred = field(true);
		const root = {
			querySelectorAll: () => [field(true, true), field(true, false, false), first, preferred]
		} as unknown as ParentNode;
		expect(findWizardFocusTarget(root)).toBe(preferred);
	});
	it('includes dropdown triggers and falls back to the first available field', () => {
		const dropdown = field();
		const querySelectorAll = vi.fn(() => [dropdown]);
		expect(findWizardFocusTarget({ querySelectorAll } as unknown as ParentNode)).toBe(dropdown);
		expect(querySelectorAll.mock.calls.length).toBe(1);
		// the query must include the actual shared listbox trigger used by the rendered wizard.
		expect(querySelectorAll).toHaveBeenCalledWith(
			expect.stringContaining('button[aria-haspopup="listbox"]')
		);
	});
	it('routes enter to the next action without invoking final submission', () => {
		const click = vi.fn();
		const form = {
			querySelector: () => ({ disabled: false, click })
		} as unknown as HTMLFormElement;
		expect(shouldSubmitWizardForm(form)).toBe(false);
		expect(click).toHaveBeenCalledOnce();
	});
	it('blocks disabled next and submit actions but allows enabled final submission', () => {
		const click = vi.fn();
		const form = {
			querySelector: (selector: string) =>
				selector === '[data-wizard-next]' ? null : { disabled: true, click }
		} as unknown as HTMLFormElement;
		expect(shouldSubmitWizardForm(form)).toBe(false);
		const blockedNext = {
			querySelector: () => ({ disabled: true, click })
		} as unknown as HTMLFormElement;
		expect(shouldSubmitWizardForm(blockedNext)).toBe(false);
		expect(click).not.toHaveBeenCalled();
		const ready = {
			querySelector: (selector: string) =>
				selector === '[data-wizard-next]' ? null : { disabled: false }
		} as unknown as HTMLFormElement;
		expect(shouldSubmitWizardForm(ready)).toBe(true);
	});
});
