/*
Brief description:
This file verifies dashboard navigation helper behavior for ordering and role-view filtering.

Deeper explanation:
The dashboard sidebar is assembled from shared navigation metadata and then adjusted for the active
auth context. Participant memberships, whether real or simulated through view-as mode, should not
keep showing links that imply higher privileges than the current effective role actually has. These
tests lock down that filtering rule in one helper so layout changes do not quietly reintroduce
hidden admin-style links.

Summary of tests:
1. It verifies that normal navigation ordering still returns every default dashboard item.
2. It verifies that participant memberships hide the management-oriented sidebar links.
3. It verifies that non-participant role views keep the full sidebar list.
4. It verifies that participant memberships lose access to management routes and keep dashboard-safe pages.
5. It verifies that developer-only routes reject non-developer roles after a role switch.
*/

import { describe, expect, it } from 'vitest';

import {
	canAccessDashboardRouteForAuthMode,
	filterDashboardNavigationItemsForAuthMode,
	orderDashboardNavigationItems
} from '../../src/lib/dashboard/navigation';

describe('dashboard navigation helper', () => {
	it('returns the full ordered navigation list outside participant view mode', () => {
		// this baseline proves the helper does not remove links during normal dashboard rendering.
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

	it('hides management links for participant memberships', () => {
		// participant users should not see links for sections they cannot actually manage.
		const items = filterDashboardNavigationItemsForAuthMode({
			items: orderDashboardNavigationItems(),
			effectiveRole: 'participant',
			isViewingAsRole: false
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

	it('keeps management links for non-participant role views', () => {
		// only the participant override should trim the sidebar; manager and admin view modes still need those sections.
		const items = filterDashboardNavigationItemsForAuthMode({
			items: orderDashboardNavigationItems(),
			effectiveRole: 'manager',
			isViewingAsRole: true
		});

		expect(items.map((item) => item.key)).toContain('memberManagement');
		expect(items.map((item) => item.key)).toContain('settings');
		expect(items).toHaveLength(12);
	});

	it('denies participant memberships access to management routes while keeping dashboard-safe pages accessible', () => {
		// this protects both real participant orgs and participant view-as mode from landing on restricted pages.
		expect(
			canAccessDashboardRouteForAuthMode({
				pathname: '/dashboard/members',
				effectiveRole: 'participant',
				isViewingAsRole: false
			})
		).toBe(false);
		expect(
			canAccessDashboardRouteForAuthMode({
				pathname: '/dashboard/settings/notifications',
				effectiveRole: 'participant',
				isViewingAsRole: false
			})
		).toBe(false);
		expect(
			canAccessDashboardRouteForAuthMode({
				pathname: '/dashboard/facilities',
				effectiveRole: 'participant',
				isViewingAsRole: false
			})
		).toBe(false);
		expect(
			canAccessDashboardRouteForAuthMode({
				pathname: '/dashboard/offerings',
				effectiveRole: 'participant',
				isViewingAsRole: false
			})
		).toBe(true);
		expect(
			canAccessDashboardRouteForAuthMode({
				pathname: '/dashboard/account',
				effectiveRole: 'participant',
				isViewingAsRole: false
			})
		).toBe(true);
	});

	it('denies developer routes for non-developer roles', () => {
		// leaving dev view on a developer page should force a safe redirect instead of rendering a 403 shell.
		expect(
			canAccessDashboardRouteForAuthMode({
				pathname: '/dashboard/dev',
				effectiveRole: 'admin',
				isViewingAsRole: true
			})
		).toBe(false);
		expect(
			canAccessDashboardRouteForAuthMode({
				pathname: '/dashboard/dev/toasts',
				effectiveRole: 'dev',
				isViewingAsRole: false
			})
		).toBe(true);
	});
});
