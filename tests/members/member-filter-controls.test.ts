/*
Brief description:
This file verifies the reusable member filter-control helpers.

Deeper explanation:
The members page now hides developer-only filter options for non-developers and keeps the search text
intact when the user resets just the filters. These tests protect those small-but-important behaviors so
future refactors do not quietly make the page more confusing.

Summary of tests:
1. It verifies that the developer role is omitted from the role filter options when it should be hidden.
2. It verifies that the developer role is included in the role filter options when it is allowed.
3. It verifies that resetting filters preserves the active search query while clearing the other controls.
*/

import { describe, expect, it } from 'vitest';
import {
	buildMemberRoleFilterOptions,
	getResetMemberFilterState
} from '../../src/lib/members/filter-controls';

describe('member filter controls', () => {
	it('omits the developer role option when the viewer should not see it', () => {
		// this keeps non-developers from seeing a role filter choice they cannot meaningfully use.
		expect(buildMemberRoleFilterOptions(false).map((option) => option.value)).toEqual([
			'',
			'participant',
			'manager',
			'admin'
		]);
	});

	it('includes the developer role option when the viewer can see developer memberships', () => {
		// developers still need the full filter set so they can inspect every membership role.
		expect(buildMemberRoleFilterOptions(true).map((option) => option.value)).toEqual([
			'',
			'participant',
			'manager',
			'admin',
			'dev'
		]);
	});

	it('preserves the active search query when resetting filters', () => {
		// the reset action should clear only the filter/sort controls, not wipe out what the user typed.
		expect(getResetMemberFilterState('jamie')).toEqual({
			searchQuery: 'jamie',
			sexFilter: '',
			roleFilter: '',
			lastActiveSeasonId: '',
			sortKey: 'lastName',
			sortDir: 'asc',
			currentPage: 1
		});
	});
});
