/*
Brief description:
This file verifies the shared option-building and filtering helpers for the view-role switcher.

Deeper explanation:
The view-role modal now mirrors the organization switcher pattern, which means it needs a stable
current-first option list, quick-key badges only on alternate roles, and search filtering that does
not reshuffle the role order. These tests protect that shaping logic without needing a browser-only
integration test.

Summary of tests:
1. It verifies that the current role appears first and does not receive a quick-key badge.
2. It verifies that alternate roles keep their expected quick-key badges.
3. It verifies that search filtering matches role labels while preserving the current-first order.
*/

import { describe, expect, it } from 'vitest';
import {
	buildViewRoleSwitcherOptions,
	filterViewRoleSwitcherOptions
} from '../../src/lib/utils/view-role-switcher';

describe('view role switcher utilities', () => {
	it('places the current role first without a quick-key badge', () => {
		// this mirrors the org switcher pattern where the current selection is included but not hot-switchable.
		const options = buildViewRoleSwitcherOptions('dev', ['admin', 'manager', 'participant']);

		expect(options[0]).toMatchObject({
			role: 'dev',
			isCurrent: true,
			quickKey: null
		});
	});

	it('keeps the alternate roles hot-switchable with their expected keycaps', () => {
		// quick keys remain part of the role-switch flow for the non-current choices below the current role.
		const options = buildViewRoleSwitcherOptions('admin', ['manager', 'participant']);

		expect(options.map((option) => [option.role, option.quickKey])).toEqual([
			['admin', null],
			['manager', 'M'],
			['participant', 'P']
		]);
	});

	it('filters by role label without reordering the current-first list', () => {
		// searching should narrow the list, not rebuild it in a different order.
		const options = buildViewRoleSwitcherOptions('dev', ['admin', 'manager', 'participant']);
		const filtered = filterViewRoleSwitcherOptions(options, 'a');

		expect(filtered.map((option) => option.role)).toEqual(['admin', 'manager', 'participant']);
	});
});
