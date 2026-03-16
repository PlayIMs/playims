/*
Brief description:
This file verifies the shared role-switch state helper used by the dashboard layout.

Deeper explanation:
The view-role button and modal target list should follow the currently effective role, not only the
original base role. These tests protect the exact state mapping the layout now uses so a nested
"view as" session can still open the switcher when the viewed role is allowed to keep stepping down.

Summary of tests:
1. It verifies that a viewed admin role can still switch to manager and participant.
2. It verifies that a viewed manager role can still switch to participant only.
3. It verifies that a viewed participant role cannot open the role switcher again.
*/

import { describe, expect, it } from 'vitest';
import { resolveViewRoleSwitcherState } from '../../src/lib/utils/view-role-state';

describe('view role switcher state', () => {
	it('keeps admin able to switch down to manager and participant', () => {
		// the helper now mirrors the server-provided targets instead of recomputing auth rules in the browser.
		const state = resolveViewRoleSwitcherState({
			effectiveRole: 'admin',
			canViewAsRole: true,
			availableTargets: ['manager', 'participant']
		});

		expect(state).toEqual({
			effectiveRole: 'admin',
			canSwitchToAnotherRole: true,
			availableTargets: ['manager', 'participant']
		});
	});

	it('limits manager to participant only', () => {
		// manager view mode should stay reusable when the server says participant is the only lower target.
		const state = resolveViewRoleSwitcherState({
			effectiveRole: 'manager',
			canViewAsRole: true,
			availableTargets: ['participant']
		});

		expect(state).toEqual({
			effectiveRole: 'manager',
			canSwitchToAnotherRole: true,
			availableTargets: ['participant']
		});
	});

	it('blocks participant from opening another nested role switch', () => {
		// participant is the floor, so the server sends no lower targets and the client should reflect that.
		const state = resolveViewRoleSwitcherState({
			effectiveRole: 'participant',
			canViewAsRole: false,
			availableTargets: []
		});

		expect(state).toEqual({
			effectiveRole: 'participant',
			canSwitchToAnotherRole: false,
			availableTargets: []
		});
	});
});
