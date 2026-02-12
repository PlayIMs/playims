/**
 * Canonical role values used by hooks, pages, and APIs.
 */
export const ROLE_VALUES = ['admin', 'manager', 'player'] as const;

export type AuthRole = (typeof ROLE_VALUES)[number];

// Current policy: dashboard and management endpoints are admin/manager only.
export const DASHBOARD_ALLOWED_ROLES: readonly AuthRole[] = ['admin', 'manager'];

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
