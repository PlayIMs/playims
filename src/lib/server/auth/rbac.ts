/**
 * Canonical role values used by hooks, pages, and APIs.
 */
export const ROLE_VALUES = ['admin', 'manager', 'player', 'dev'] as const;

export type AuthRole = (typeof ROLE_VALUES)[number];

// Current policy: dashboard and management endpoints are admin/manager/dev only.
export const DASHBOARD_ALLOWED_ROLES: readonly AuthRole[] = ['admin', 'manager', 'dev'];
export const ADMIN_LIKE_ROLES: readonly AuthRole[] = ['admin', 'dev'];
export const VIEW_AS_PLAYER_ALLOWED_ROLES: readonly AuthRole[] = ['admin', 'manager', 'dev'];

const ROLE_SET = new Set<AuthRole>(ROLE_VALUES);

export const normalizeRole = (value: string | null | undefined): AuthRole => {
	if (!value) {
		return 'player';
	}
	const normalized = value.trim().toLowerCase();
	return ROLE_SET.has(normalized as AuthRole) ? (normalized as AuthRole) : 'player';
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

export const canViewAsPlayerRole = (role: string | null | undefined): boolean =>
	hasAnyRole(role, VIEW_AS_PLAYER_ALLOWED_ROLES);
