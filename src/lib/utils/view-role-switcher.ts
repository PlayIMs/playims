export type ViewSwitcherRole = string;

export type ViewRoleSwitcherOption = {
	role: ViewSwitcherRole;
	title: string;
	description: string;
	searchText: string;
	isCurrent: boolean;
	quickKey: string | null;
};

const toRoleLabel = (role: ViewSwitcherRole): string =>
	role
		.trim()
		.split(/[_\s-]+/)
		.filter(Boolean)
		.map((segment) => segment[0]?.toUpperCase() + segment.slice(1).toLowerCase())
		.join(' ');

const toRoleQuickKey = (role: ViewSwitcherRole): string =>
	role.trim().charAt(0).toUpperCase();

export const buildViewRoleSwitcherOptions = (
	currentRole: ViewSwitcherRole,
	allowedRoles: ViewSwitcherRole[]
): ViewRoleSwitcherOption[] => {
	const orderedRoles = [currentRole, ...allowedRoles.filter((role) => role !== currentRole)];

	return orderedRoles.map((role) => {
		const isCurrent = role === currentRole;
		const title = toRoleLabel(role);

		return {
			role,
			title,
			description: isCurrent
				? `Current role view. Permissions match ${title}.`
				: `Switch to ${title} view permissions.`,
			searchText: `${title} ${role}`,
			isCurrent,
			quickKey: isCurrent ? null : toRoleQuickKey(role)
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
