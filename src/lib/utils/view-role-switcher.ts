export type ViewSwitcherRole = 'participant' | 'manager' | 'admin' | 'dev';

export type ViewRoleSwitcherOption = {
	role: ViewSwitcherRole;
	title: string;
	description: string;
	searchText: string;
	isCurrent: boolean;
	quickKey: string | null;
};

const roleLabel: Record<ViewSwitcherRole, string> = {
	participant: 'Participant',
	manager: 'Manager',
	admin: 'Admin',
	dev: 'Dev'
};

const roleQuickKey: Record<ViewSwitcherRole, string> = {
	participant: 'P',
	manager: 'M',
	admin: 'A',
	dev: 'D'
};

export const buildViewRoleSwitcherOptions = (
	currentRole: ViewSwitcherRole,
	allowedRoles: ViewSwitcherRole[]
): ViewRoleSwitcherOption[] => {
	const orderedRoles = [currentRole, ...allowedRoles.filter((role) => role !== currentRole)];

	return orderedRoles.map((role) => {
		const isCurrent = role === currentRole;
		const title = roleLabel[role];

		return {
			role,
			title,
			description: isCurrent
				? `Current role view. Permissions match ${title}.`
				: `Switch to ${title} view permissions.`,
			searchText: `${title} ${role}`,
			isCurrent,
			quickKey: isCurrent ? null : roleQuickKey[role]
		};
	});
};

export const filterViewRoleSwitcherOptions = (
	options: ViewRoleSwitcherOption[],
	searchTerm: string
): ViewRoleSwitcherOption[] => {
	const normalizedSearch = searchTerm.trim().toLowerCase();
	if (!normalizedSearch) {
		return options;
	}

	return options.filter((option) => option.searchText.toLowerCase().includes(normalizedSearch));
};
