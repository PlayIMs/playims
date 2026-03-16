export interface OrganizationSwitcherOption {
	clientId: string;
	clientName: string;
	clientSlug: string | null;
	role: string;
	isCurrent: boolean;
	isDefault: boolean;
	lastUsedAt: string | null;
}

export function sortOrganizationsForSwitcher(
	organizations: OrganizationSwitcherOption[],
	currentOrganizationId: string
): OrganizationSwitcherOption[] {
	return [...organizations].sort((a, b) => {
		const aIsCurrent = a.clientId === currentOrganizationId || a.isCurrent;
		const bIsCurrent = b.clientId === currentOrganizationId || b.isCurrent;
		if (aIsCurrent && !bIsCurrent) return -1;
		if (!aIsCurrent && bIsCurrent) return 1;

		const aLastUsedAt = Date.parse(a.lastUsedAt ?? '');
		const bLastUsedAt = Date.parse(b.lastUsedAt ?? '');
		const aHasLastUsed = Number.isFinite(aLastUsedAt);
		const bHasLastUsed = Number.isFinite(bLastUsedAt);
		if (aHasLastUsed && bHasLastUsed && aLastUsedAt !== bLastUsedAt) {
			return bLastUsedAt - aLastUsedAt;
		}
		if (aHasLastUsed && !bHasLastUsed) return -1;
		if (!aHasLastUsed && bHasLastUsed) return 1;

		return a.clientName.localeCompare(b.clientName, 'en', { sensitivity: 'base' });
	});
}

export function filterOrganizationsForSwitcher(
	organizations: OrganizationSwitcherOption[],
	query: string
): OrganizationSwitcherOption[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return organizations;
	}

	return organizations.filter((organization) => {
		const searchableText =
			`${organization.clientName} ${organization.clientSlug ?? ''} ${organization.role}`.toLowerCase();
		return searchableText.includes(normalizedQuery);
	});
}
