/*
Brief description:
This file verifies the shared toast placement defaults and override rules.

Deeper explanation:
Most routes in the app rely on the shared toast helper instead of specifying a placement every time.
That makes the helper's default placement a product-level behavior, not a small implementation detail.
These tests protect the default top-right desktop stack, the top mobile stack, and the rule that an
explicit placement or mobile placement must still win when a screen asks for something custom.

Summary of tests:
1. It verifies that unspecified toasts default to the top-right desktop stack and top mobile stack.
2. It verifies that an explicit desktop placement derives the matching mobile row when no mobile override is given.
3. It verifies that an explicit mobile placement still overrides the derived mobile row.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import {
	DEFAULT_TOAST_DESKTOP_PLACEMENT,
	DEFAULT_TOAST_MOBILE_PLACEMENT,
	toast,
	toastStore,
	type ToastRecord
} from '../../src/lib/toasts';

function readToastStore() {
	let current: ToastRecord[] = [];

	// the store subscription fires synchronously, which makes it a simple way to inspect the latest stack.
	const unsubscribe = toastStore.subscribe((value) => {
		current = value;
	});
	unsubscribe();
	return current;
}

describe('shared toast defaults', () => {
	beforeEach(() => {
		// every test starts with an empty stack so one assertion cannot leak state into the next one.
		toast.dismissAll();
	});

	it('defaults unspecified toasts to the top-right desktop stack and top mobile stack', () => {
		// most production screens rely on this default instead of passing a placement on every toast call.
		toast.success('Saved successfully.');

		expect(readToastStore()).toEqual([
			expect.objectContaining({
				placement: DEFAULT_TOAST_DESKTOP_PLACEMENT,
				mobilePlacement: DEFAULT_TOAST_MOBILE_PLACEMENT
			})
		]);
	});

	it('derives the mobile stack from an explicit desktop placement when needed', () => {
		// custom desktop placements should still land in a matching mobile row without extra boilerplate.
		toast.info('Moved to another stack.', {
			placement: 'bottom-left'
		});

		expect(readToastStore()).toEqual([
			expect.objectContaining({
				placement: 'bottom-left',
				mobilePlacement: 'bottom'
			})
		]);
	});

	it('keeps an explicit mobile placement override when one is provided', () => {
		// this protects routes that intentionally want a different mobile row than the desktop-derived one.
		toast.warning('Custom mobile row.', {
			placement: 'middle-right',
			mobilePlacement: 'top'
		});

		expect(readToastStore()).toEqual([
			expect.objectContaining({
				placement: 'middle-right',
				mobilePlacement: 'top'
			})
		]);
	});
});
