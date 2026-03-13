const APP_NAME = 'PlayIMs';

type UnknownRecord = Record<string, unknown>;

const normalizeSegment = (value: string | null | undefined): string | null => {
	const normalized = value?.trim() ?? '';
	return normalized.length > 0 ? normalized : null;
};

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null;

const readNamedValue = (record: UnknownRecord, keys: string[]): string | null => {
	for (const key of keys) {
		const candidate = record[key];
		if (typeof candidate === 'string') {
			const normalized = normalizeSegment(candidate);
			if (normalized) {
				return normalized;
			}
		}
	}

	return null;
};

const readOrganizationFromEntry = (value: unknown): string | null => {
	if (!isRecord(value)) {
		return null;
	}

	return readNamedValue(value, ['clientName', 'organizationName', 'name']);
};

export const buildDocumentTitle = (
	pageTitle: string | null | undefined,
	organizationName?: string | null
): string => {
	const normalizedPageTitle = normalizeSegment(pageTitle);
	const normalizedOrganizationName = normalizeSegment(organizationName);
	const segments = [APP_NAME];

	if (normalizedPageTitle) {
		segments.push(normalizedPageTitle);
	}

	if (
		normalizedOrganizationName &&
		normalizedOrganizationName.localeCompare(normalizedPageTitle ?? '', undefined, {
			sensitivity: 'accent'
		}) !== 0
	) {
		segments.push(normalizedOrganizationName);
	}

	return segments.join(' - ');
};

export const resolveOrganizationNameFromPageData = (pageData: unknown): string | null => {
	if (!isRecord(pageData)) {
		return null;
	}

	const directName = readNamedValue(pageData, ['organizationName', 'orgName', 'clientName']);
	if (directName) {
		return directName;
	}

	const currentOrganization = readOrganizationFromEntry(pageData.currentOrganization);
	if (currentOrganization) {
		return currentOrganization;
	}

	if (Array.isArray(pageData.organizations)) {
		const currentEntry =
			pageData.organizations.find(
				(entry) => isRecord(entry) && entry.isCurrent === true
			) ?? pageData.organizations[0];
		const organizationFromList = readOrganizationFromEntry(currentEntry);
		if (organizationFromList) {
			return organizationFromList;
		}
	}

	const clientName = readOrganizationFromEntry(pageData.client);
	if (clientName) {
		return clientName;
	}

	if (isRecord(pageData.invite)) {
		const inviteName = readNamedValue(pageData.invite, ['clientName', 'organizationName']);
		if (inviteName) {
			return inviteName;
		}
	}

	return null;
};
