/**
 * Canonical role values used by hooks, pages, and APIs.
 */
export const ROLE_VALUES = ['participant', 'manager', 'admin', 'dev'] as const;

export type AuthRole = (typeof ROLE_VALUES)[number];

// Current policy: dashboard and management endpoints are admin/manager/dev only.
export const DASHBOARD_ALLOWED_ROLES: readonly AuthRole[] = ['admin', 'manager', 'dev'];
export const ADMIN_LIKE_ROLES: readonly AuthRole[] = ['admin', 'dev'];
export const VIEW_AS_ROLE_ALLOWED_ROLES: readonly AuthRole[] = ['manager', 'admin', 'dev'];

const ROLE_SET = new Set<AuthRole>(ROLE_VALUES);
const ROLE_ORDER: Record<AuthRole, number> = {
	participant: 0,
	manager: 1,
	admin: 2,
	dev: 3
};

export const normalizeRole = (value: string | null | undefined): AuthRole => {
	if (!value) {
		return 'participant';
	}
	const normalized = value.trim().toLowerCase();
	return ROLE_SET.has(normalized as AuthRole) ? (normalized as AuthRole) : 'participant';
};

export const normalizeRoleOrNull = (value: string | null | undefined): AuthRole | null => {
	if (!value) {
		return null;
	}
	const normalized = value.trim().toLowerCase();
	return ROLE_SET.has(normalized as AuthRole) ? (normalized as AuthRole) : null;
};

/**
 * Convenience helper for role gate checks.
 */
export const hasAnyRole = (
	role: string | null | undefined,
	allowedRoles: readonly AuthRole[]
): boolean => {
	const normalized = normalizeRole(role);
	return allowedRoles.includes(normalized);
};

export const isAdminLikeRole = (role: string | null | undefined): boolean =>
	hasAnyRole(role, ADMIN_LIKE_ROLES);

export const isDevRole = (role: string | null | undefined): boolean => normalizeRole(role) === 'dev';

export const canViewAsRole = (role: string | null | undefined): boolean =>
	hasAnyRole(role, VIEW_AS_ROLE_ALLOWED_ROLES);

export const canViewAsLowerRole = (
	baseRole: string | null | undefined,
	targetRole: string | null | undefined
): boolean => {
	const normalizedBaseRole = normalizeRole(baseRole);
	const normalizedTargetRole = normalizeRoleOrNull(targetRole);
	if (!normalizedTargetRole) {
		return false;
	}
	return ROLE_ORDER[normalizedTargetRole] < ROLE_ORDER[normalizedBaseRole];
};

export const getViewAsRoleTargets = (role: string | null | undefined): AuthRole[] => {
	const normalizedRole = normalizeRole(role);
	return ROLE_VALUES.filter((candidate) => ROLE_ORDER[candidate] < ROLE_ORDER[normalizedRole]);
};
