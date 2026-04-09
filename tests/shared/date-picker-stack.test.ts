/*
Brief description:
This file verifies the shared stack that coordinates Escape behavior for open date pickers.

Deeper explanation:
The custom date picker can open inside modals and wizards that also listen for Escape. These tests
protect the source-of-truth stack so the newest open picker is treated as the topmost overlay and
the modal layer can tell when it should ignore the first Escape press.

Summary of tests:
1. It verifies a registered picker is reported as open and topmost.
2. It verifies topmost tracking follows the most recently opened picker.
3. It verifies unregistering a picker reveals the previous picker beneath it.
4. It verifies removing the final picker clears the shared open state.
*/

import { afterEach, describe, expect, it } from 'vitest';

import {
	hasOpenDatePicker,
	isTopDatePicker,
	registerOpenDatePicker,
	unregisterOpenDatePicker
} from '../../src/lib/components/date-picker-stack';

function clearPicker(id: symbol): void {
	unregisterOpenDatePicker(id);
}

afterEach(() => {
	// each test should leave the shared stack empty so later tests see a clean overlay state.
	clearPicker(Symbol.for('date-picker-a'));
	clearPicker(Symbol.for('date-picker-b'));
	clearPicker(Symbol.for('date-picker-c'));
});

describe('date-picker stack', () => {
	it('reports a registered picker as open and topmost', () => {
		const pickerId = Symbol.for('date-picker-a');

		registerOpenDatePicker(pickerId);

		expect(hasOpenDatePicker()).toBe(true);
		expect(isTopDatePicker(pickerId)).toBe(true);

		unregisterOpenDatePicker(pickerId);
	});

	it('tracks the most recently opened picker as the top overlay', () => {
		const firstPickerId = Symbol.for('date-picker-a');
		const secondPickerId = Symbol.for('date-picker-b');

		registerOpenDatePicker(firstPickerId);
		registerOpenDatePicker(secondPickerId);

		expect(isTopDatePicker(firstPickerId)).toBe(false);
		expect(isTopDatePicker(secondPickerId)).toBe(true);

		unregisterOpenDatePicker(secondPickerId);
		unregisterOpenDatePicker(firstPickerId);
	});

	it('reveals the previous picker when the topmost picker closes', () => {
		const firstPickerId = Symbol.for('date-picker-a');
		const secondPickerId = Symbol.for('date-picker-b');

		registerOpenDatePicker(firstPickerId);
		registerOpenDatePicker(secondPickerId);
		unregisterOpenDatePicker(secondPickerId);

		expect(isTopDatePicker(firstPickerId)).toBe(true);

		unregisterOpenDatePicker(firstPickerId);
	});

	it('clears the shared open state when the final picker closes', () => {
		const pickerId = Symbol.for('date-picker-a');

		registerOpenDatePicker(pickerId);
		unregisterOpenDatePicker(pickerId);

		expect(hasOpenDatePicker()).toBe(false);
	});
});
