/*
Brief description:
This file verifies the centralized server-side permission registry and role inheritance.

Deeper explanation:
The new permission module becomes the single source of truth for role hierarchy, inherited access,
and browser-safe permission snapshots. If that registry resolves permissions incorrectly, the rest of
the app can either over-authorize or hide valid functionality. These tests lock the expected role
matrix and the defensive validation behavior in one place.

Summary of tests:
1. It verifies that participant permissions stay limited to safe read-only dashboard areas.
2. It verifies that manager inherits participant permissions, gains communication-center access, and gains operational write access.
3. It verifies that admin inherits manager permissions and gains elevated organization and member control.
4. It verifies that dev inherits admin permissions and keeps developer-only access.
5. It verifies that permission snapshots expose booleans for each known permission.
6. It verifies that view-as targets follow the configured role ranking.
7. It verifies that registry validation rejects unknown inherited roles.
*/

import { describe, expect, it } from 'vitest';

import {
	PERMISSIONS,
	buildPermissionSnapshot,
	createPermissionRegistry,
	getViewAsRoleTargets,
	hasPermission,
	type AuthRole
} from '../../src/lib/server/auth/permissions';

const expectPermission = (
	role: AuthRole,
	permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
) => {
	// this helper keeps each test focused on the permission intent instead of repeated assertion plumbing.
	expect(hasPermission(role, permission)).toBe(true);
};

const expectNoPermission = (
	role: AuthRole,
	permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
) => {
	// negative checks matter here because inheritance bugs usually surface as accidental extra access.
	expect(hasPermission(role, permission)).toBe(false);
};

describe('permission registry', () => {
	it('keeps participant restricted to safe read-only dashboard access', () => {
		// participant is the lowest real app role, so it should not inherit management or developer powers.
		expectPermission('participant', PERMISSIONS.VIEW_DASHBOARD_HOME);
		expectPermission('participant', PERMISSIONS.VIEW_SCHEDULE);
		expectPermission('participant', PERMISSIONS.VIEW_OFFERINGS);
		expectPermission('participant', PERMISSIONS.VIEW_ACCOUNT);
		expectNoPermission('participant', PERMISSIONS.VIEW_COMMUNICATION_CENTER);
		expectNoPermission('participant', PERMISSIONS.VIEW_COMMUNICATION_HISTORY);
		expectNoPermission('participant', PERMISSIONS.PREVIEW_COMMUNICATION_AUDIENCE);
		expectNoPermission('participant', PERMISSIONS.CREATE_COMMUNICATION_DRAFT);
		expectNoPermission('participant', PERMISSIONS.EDIT_COMMUNICATION_DRAFT);
		expectNoPermission('participant', PERMISSIONS.DELETE_COMMUNICATION_DRAFT);
		expectNoPermission('participant', PERMISSIONS.SEND_COMMUNICATION);
		expectNoPermission('participant', PERMISSIONS.VIEW_SETTINGS);
		expectNoPermission('participant', PERMISSIONS.MANAGE_FACILITIES);
		expectNoPermission('participant', PERMISSIONS.MANAGE_OFFERINGS);
		expectNoPermission('participant', PERMISSIONS.ADD_MEMBER);
		expectNoPermission('participant', PERMISSIONS.ACCESS_DEV_TOOLS);
	});

	it('lets manager inherit participant access and gain operational writes', () => {
		// manager should keep day-to-day operations, including adding members, without receiving elevated admin-only account control.
		expectPermission('manager', PERMISSIONS.VIEW_DASHBOARD_HOME);
		expectPermission('manager', PERMISSIONS.VIEW_SETTINGS);
		expectPermission('manager', PERMISSIONS.VIEW_COMMUNICATION_CENTER);
		expectPermission('manager', PERMISSIONS.VIEW_COMMUNICATION_HISTORY);
		expectPermission('manager', PERMISSIONS.PREVIEW_COMMUNICATION_AUDIENCE);
		expectPermission('manager', PERMISSIONS.CREATE_COMMUNICATION_DRAFT);
		expectPermission('manager', PERMISSIONS.EDIT_COMMUNICATION_DRAFT);
		expectPermission('manager', PERMISSIONS.DELETE_COMMUNICATION_DRAFT);
		expectPermission('manager', PERMISSIONS.SEND_COMMUNICATION);
		expectPermission('manager', PERMISSIONS.DUPLICATE_COMMUNICATION);
		expectPermission('manager', PERMISSIONS.MANAGE_FACILITIES);
		expectPermission('manager', PERMISSIONS.MANAGE_OFFERINGS);
		expectPermission('manager', PERMISSIONS.EDIT_NAVIGATION_SETTINGS);
		expectPermission('manager', PERMISSIONS.MANAGE_THEMES);
		expectPermission('manager', PERMISSIONS.ADD_MEMBER);
		expectNoPermission('manager', PERMISSIONS.CHANGE_MEMBER_ROLE);
		expectNoPermission('manager', PERMISSIONS.REMOVE_MEMBER);
		expectNoPermission('manager', PERMISSIONS.EDIT_ORGANIZATION_DETAILS);
		expectNoPermission('manager', PERMISSIONS.ACCESS_DEV_TOOLS);
	});

	it('lets admin inherit manager access and gain elevated controls', () => {
		// admin is where sensitive organization and member-management authority starts.
		expectPermission('admin', PERMISSIONS.MANAGE_FACILITIES);
		expectPermission('admin', PERMISSIONS.MANAGE_OFFERINGS);
		expectPermission('admin', PERMISSIONS.ADD_MEMBER);
		expectPermission('admin', PERMISSIONS.CHANGE_MEMBER_ROLE);
		expectPermission('admin', PERMISSIONS.REMOVE_MEMBER);
		expectPermission('admin', PERMISSIONS.CREATE_ORGANIZATION);
		expectPermission('admin', PERMISSIONS.EDIT_ORGANIZATION_DETAILS);
		expectPermission('admin', PERMISSIONS.VIEW_AS_ROLE);
		expectNoPermission('admin', PERMISSIONS.ACCESS_DEV_TOOLS);
	});

	it('lets dev inherit admin access and keep developer-only tools', () => {
		// dev should behave like the superset role because the app has a dedicated developer surface.
		expectPermission('dev', PERMISSIONS.CHANGE_MEMBER_ROLE);
		expectPermission('dev', PERMISSIONS.EDIT_ORGANIZATION_DETAILS);
		expectPermission('dev', PERMISSIONS.ACCESS_DEV_TOOLS);
	});

	it('builds boolean snapshots for every permission', () => {
		// the browser only needs booleans, so the snapshot should expose the full known permission list.
		const snapshot = buildPermissionSnapshot('manager');

		expect(snapshot.VIEW_DASHBOARD_HOME).toBe(true);
		expect(snapshot.MANAGE_OFFERINGS).toBe(true);
		expect(snapshot.CHANGE_MEMBER_ROLE).toBe(false);
		expect(Object.keys(snapshot).sort()).toEqual(Object.values(PERMISSIONS).sort());
	});

	it('returns lower-ranked view-as targets in highest-first order', () => {
		// view-as mode should only allow stepping down the hierarchy, never sideways or upward.
		expect(getViewAsRoleTargets('dev')).toEqual(['admin', 'manager', 'participant']);
		expect(getViewAsRoleTargets('admin')).toEqual(['manager', 'participant']);
		expect(getViewAsRoleTargets('manager')).toEqual(['participant']);
		expect(getViewAsRoleTargets('participant')).toEqual([]);
	});

	it('rejects registries that inherit from unknown roles', () => {
		// fail-fast validation keeps typoed role inheritance from silently weakening authorization.
		expect(() =>
			createPermissionRegistry({
				permissions: {
					VIEW_ONLY: 'VIEW_ONLY'
				},
				roles: {
					participant: {
						label: 'Participant',
						rank: 0,
						permissions: ['VIEW_ONLY']
					},
					manager: {
						label: 'Manager',
						rank: 1,
						inherits: ['missing-role'],
						permissions: []
					}
				}
			})
		).toThrow(/unknown inherited role/i);
	});
});
