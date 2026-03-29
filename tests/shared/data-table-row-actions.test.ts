/*
Brief description:
This file verifies the shared DataTable row-action helpers for manage columns and single-action behavior.

Deeper explanation:
Several dashboard tables now share the same right-side settings column pattern. These tests protect the
source-of-truth helpers that define the standard manage column shape and decide whether the trigger should
open a dropdown or run one action directly. That keeps future table refactors from drifting into slightly
different column sizing or awkward one-item dropdown menus.

Summary of tests:
1. It verifies that the shared manage column helper returns the standard right-aligned compact column recipe.
2. It verifies that a row with no actions reports no trigger behavior.
3. It verifies that a row with exactly one action uses direct trigger behavior and returns that action.
4. It verifies that multiple actions keep dropdown behavior instead of auto-running the first option.
*/

import { describe, expect, it } from 'vitest';

import {
	createDataTableRowActionColumn,
	getDataTableRowActionMode,
	getSingleDataTableRowActionOption,
	type DataTableRowActionOption
} from '../../src/lib/components/data-table';

describe('data table row action helpers', () => {
	it('returns the standard compact manage column recipe', () => {
		// this keeps future tables aligned on the same narrow settings column without retyping the recipe.
		const column = createDataTableRowActionColumn();

		expect(column).toMatchObject({
			key: 'manage',
			label: '',
			width: '2.75rem',
			headerPaddingX: 'none',
			cellPaddingX: 'none',
			cellPaddingLeft: '0.125rem',
			cellPaddingRight: '0.125rem',
			headerTextAlignment: 'right',
			cellTextAlignment: 'right',
			cellVerticalAlignment: 'middle',
			headerTextTransform: 'normal'
		});
	});

	it('reports no trigger behavior when no actions exist', () => {
		// an empty action set should not render an empty trigger.
		expect(getDataTableRowActionMode([])).toBe('none');
		expect(getSingleDataTableRowActionOption([])).toBeNull();
	});

	it('uses direct behavior when exactly one action exists', () => {
		const options: DataTableRowActionOption[] = [{ value: 'edit', label: 'Edit League' }];

		// one action should skip the dropdown and behave like a direct click target.
		expect(getDataTableRowActionMode(options)).toBe('single');
		expect(getSingleDataTableRowActionOption(options)).toEqual(options[0]);
	});

	it('keeps dropdown behavior when multiple actions exist', () => {
		const options: DataTableRowActionOption[] = [
			{ value: 'edit', label: 'Edit League' },
			{ value: 'delete', label: 'Delete League' }
		];

		// once there is more than one visible choice, the user still needs the menu.
		expect(getDataTableRowActionMode(options)).toBe('menu');
		expect(getSingleDataTableRowActionOption(options)).toBeNull();
	});
});
