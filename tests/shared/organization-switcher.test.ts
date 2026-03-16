import { describe, expect, it } from 'vitest';

import {
	filterOrganizationsForSwitcher,
	sortOrganizationsForSwitcher,
	type OrganizationSwitcherOption
} from '../../src/lib/utils/organization-switcher';

const organizations: OrganizationSwitcherOption[] = [
	{
		clientId: 'current',
		clientName: 'PlayIMs Campus',
		clientSlug: 'playims-campus',
		role: 'admin',
		isCurrent: true,
		isDefault: true,
		lastUsedAt: '2026-03-15T01:00:00.000Z'
	},
	{
		clientId: 'beta',
		clientName: 'Beta Org',
		clientSlug: 'beta-org',
		role: 'manager',
		isCurrent: false,
		isDefault: false,
		lastUsedAt: '2026-03-14T20:00:00.000Z'
	},
	{
		clientId: 'alpha',
		clientName: 'Alpha Org',
		clientSlug: 'alpha-org',
		role: 'participant',
		isCurrent: false,
		isDefault: false,
		lastUsedAt: '2026-03-14T21:00:00.000Z'
	},
	{
		clientId: 'gamma',
		clientName: 'Gamma Org',
		clientSlug: 'gamma-org',
		role: 'dev',
		isCurrent: false,
		isDefault: false,
		lastUsedAt: null
	}
];

describe('organization switcher utilities', () => {
	it('keeps the current organization first and sorts the rest by recency', () => {
		expect(
			sortOrganizationsForSwitcher(organizations, 'current').map((organization) => organization.clientId)
		).toEqual(['current', 'alpha', 'beta', 'gamma']);
	});

	it('falls back to alphabetical order for organizations without recency history', () => {
		const withoutRecency = organizations.map((organization) => ({
			...organization,
			lastUsedAt: null
		}));

		expect(
			sortOrganizationsForSwitcher(withoutRecency, 'current').map(
				(organization) => organization.clientId
			)
		).toEqual(['current', 'alpha', 'beta', 'gamma']);
	});

	it('filters organizations by name, slug, or role', () => {
		expect(filterOrganizationsForSwitcher(organizations, 'beta').map((item) => item.clientId)).toEqual([
			'beta'
		]);
		expect(filterOrganizationsForSwitcher(organizations, 'participant').map((item) => item.clientId)).toEqual([
			'alpha'
		]);
		expect(filterOrganizationsForSwitcher(organizations, 'campus').map((item) => item.clientId)).toEqual([
			'current'
		]);
	});
});
