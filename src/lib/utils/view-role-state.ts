import type { ViewSwitcherRole } from './view-role-switcher';

export type ViewRoleSwitcherState = {
	effectiveRole: ViewSwitcherRole;
	canSwitchToAnotherRole: boolean;
	availableTargets: ViewSwitcherRole[];
};

const normalizeRole = (value: string | null | undefined): ViewSwitcherRole => {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'manager' || normalized === 'admin' || normalized === 'dev') {
		return normalized;
	}

	return 'participant';
};

export const resolveViewRoleSwitcherState = (input: {
	effectiveRole: string | null | undefined;
	canViewAsRole: boolean;
	availableTargets: readonly string[];
}): ViewRoleSwitcherState => ({
	effectiveRole: normalizeRole(input.effectiveRole),
	canSwitchToAnotherRole: input.canViewAsRole === true,
	availableTargets: input.availableTargets.map((role) => normalizeRole(role))
});
