/*
Brief description:
This file verifies the shared page-title helpers that format tab titles and derive organization names.

Deeper explanation:
The app now relies on one shared title builder so browser tabs and installed PWA windows stay
consistent. These tests protect both pieces of logic: the visible title format itself and the
organization-name lookup that pulls the current org from merged SvelteKit page data.

Summary of tests:
1. It verifies that page titles follow the PlayIMs prefix format.
2. It verifies that duplicate page and organization names are not repeated in the final title.
3. It verifies that the current organization is preferred from dashboard layout data.
4. It verifies that invite and public client pages can still supply an organization name.
*/

import { describe, expect, it } from 'vitest';
import { buildDocumentTitle, resolveOrganizationNameFromPageData } from '../../src/lib/utils/page-title';

describe('page title helpers', () => {
	it('builds titles in the shared playims format', () => {
		// this locks in the new tab-title pattern used across the app shell and installed pwa.
		expect(buildDocumentTitle('Dashboard', 'PlayIMs Campus')).toBe(
			'PlayIMs - Dashboard - PlayIMs Campus'
		);
		expect(buildDocumentTitle('Home')).toBe('PlayIMs - Home');
	});

	it('avoids repeating the same name twice when the page title already matches the org name', () => {
		// public org pages can use the org name as the page title, so the helper should not duplicate it.
		expect(buildDocumentTitle('PlayIMs Campus', 'PlayIMs Campus')).toBe(
			'PlayIMs - PlayIMs Campus'
		);
	});

	it('prefers the current organization from merged dashboard page data', () => {
		// dashboard pages inherit organizations from layout data, and the current org should drive the suffix.
		expect(
			resolveOrganizationNameFromPageData({
				organizations: [
					{ clientName: 'Alpha Org', isCurrent: false },
					{ clientName: 'Beta Org', isCurrent: true }
				]
			})
		).toBe('Beta Org');
	});

	it('falls back to invite and client page data when dashboard memberships are unavailable', () => {
		// invite and public access routes do not have dashboard org data, so they need separate fallbacks.
		expect(
			resolveOrganizationNameFromPageData({
				invite: {
					clientName: 'Invite Org'
				}
			})
		).toBe('Invite Org');
		expect(
			resolveOrganizationNameFromPageData({
				client: {
					name: 'Public Org'
				}
			})
		).toBe('Public Org');
	});
});
