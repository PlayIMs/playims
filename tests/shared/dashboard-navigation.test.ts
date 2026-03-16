/*
Brief description:
This file verifies dashboard navigation helper behavior for ordering and permission-driven filtering.

Deeper explanation:
The dashboard sidebar and protected route checks now depend on a server-computed permission snapshot
instead of raw client-visible role names. These tests lock in the permission mapping so participant
views stay limited, manager/admin views keep their operational sections, and developer-only routes
remain isolated behind the dedicated developer permission.

Summary of tests:
1. It verifies that normal navigation ordering still returns every default dashboard item.
2. It verifies that participant permission snapshots hide management-oriented sidebar links.
3. It verifies that manager permission snapshots keep the full sidebar list.
4. It verifies that participant permission snapshots lose access to management routes and keep safe pages.
5. It verifies that developer-only routes reject non-developer snapshots.
*/

import { describe, expect, it } from 'vitest';

import {
	canAccessDashboardRouteForPermissions,
	filterDashboardNavigationItemsForPermissions,
	orderDashboardNavigationItems
} from '../../src/lib/dashboard/navigation';
import { buildPermissionSnapshot } from '../../src/lib/server/auth/permissions';

describe('dashboard navigation helper', () => {
	it('returns the full ordered navigation list outside permission filtering', () => {
		// this baseline proves the helper still preserves the shared dashboard ordering metadata.
		const items = orderDashboardNavigationItems();

		expect(items.map((item) => item.key)).toEqual([
			'dashboard',
			'schedule',
			'offerings',
			'clubSports',
			'memberManagement',
			'communicationCenter',
			'facilities',
			'equipmentCheckout',
			'payments',
			'forms',
			'reports',
			'settings'
		]);
	});

	it('hides management links for participant permission snapshots', () => {
		// participant should only keep the navigation items backed by its safe read-only permissions.
		const items = filterDashboardNavigationItemsForPermissions({
			items: orderDashboardNavigationItems(),
			permissions: buildPermissionSnapshot('participant')
		});

		expect(items.map((item) => item.key)).toEqual([
			'dashboard',
			'schedule',
			'offerings',
			'clubSports',
			'communicationCenter',
			'equipmentCheckout'
		]);
	});

	it('keeps management links for manager permission snapshots', () => {
		// manager inherits participant visibility and adds the operational sections back in.
		const items = filterDashboardNavigationItemsForPermissions({
			items: orderDashboardNavigationItems(),
			permissions: buildPermissionSnapshot('manager')
		});

		expect(items.map((item) => item.key)).toContain('memberManagement');
		expect(items.map((item) => item.key)).toContain('settings');
		expect(items).toHaveLength(12);
	});

	it('denies participant access to restricted dashboard routes while keeping safe routes available', () => {
		// these assertions mirror the route guard behavior the dashboard shell should follow after hydration.
		const participantPermissions = buildPermissionSnapshot('participant');

		expect(
			canAccessDashboardRouteForPermissions({
				pathname: '/dashboard/members',
				permissions: participantPermissions
			})
		).toBe(false);
		expect(
			canAccessDashboardRouteForPermissions({
				pathname: '/dashboard/settings/notifications',
				permissions: participantPermissions
			})
		).toBe(true);
		expect(
			canAccessDashboardRouteForPermissions({
				pathname: '/dashboard/facilities',
				permissions: participantPermissions
			})
		).toBe(false);
		expect(
			canAccessDashboardRouteForPermissions({
				pathname: '/dashboard/offerings',
				permissions: participantPermissions
			})
		).toBe(true);
		expect(
			canAccessDashboardRouteForPermissions({
				pathname: '/dashboard/account',
				permissions: participantPermissions
			})
		).toBe(true);
	});

	it('denies developer routes for non-developer permission snapshots', () => {
		// the dedicated developer permission should be the only thing that opens the dev route family.
		expect(
			canAccessDashboardRouteForPermissions({
				pathname: '/dashboard/dev',
				permissions: buildPermissionSnapshot('admin')
			})
		).toBe(false);
		expect(
			canAccessDashboardRouteForPermissions({
				pathname: '/dashboard/dev/toasts',
				permissions: buildPermissionSnapshot('dev')
			})
		).toBe(true);
	});
});
