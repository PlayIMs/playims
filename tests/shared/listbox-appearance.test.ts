/*
Brief description:
This file verifies inherited dropdown appearance inside modals.

Deeper explanation:
Form selectors should inherit field styling inside the shared shell without every caller remembering
an extra prop. Action menus and deliberately customized triggers keep their existing appearance.

Summary of tests:
1. It verifies modal field defaults, action menus, explicit variants, and custom trigger exceptions.
*/
import { describe, expect, it } from 'vitest';
import { resolveListboxVariant } from '../../src/lib/components/listbox-appearance';

describe('inherited listbox appearance', () => {
	it('inherits form appearance while preserving explicit exceptions', () => {
		// explicit variants are stronger than context; copied trigger classes remain backward compatible.
		expect(resolveListboxVariant('auto', true, 'select', '')).toBe('field');
		expect(resolveListboxVariant('auto', false, 'select', '')).toBe('button');
		expect(resolveListboxVariant('auto', true, 'action', '')).toBe('button');
		expect(resolveListboxVariant('auto', true, 'select', 'dashboard-icon-button')).toBe('button');
		expect(resolveListboxVariant('button', true, 'select', '')).toBe('button');
		expect(resolveListboxVariant('field', false, 'select', '')).toBe('field');
	});
});
