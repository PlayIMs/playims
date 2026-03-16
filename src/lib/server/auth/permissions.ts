/**
 * Centralized server-only permission registry for PlayIMs.
 *
 * What this file controls:
 * - Every canonical auth role name in the app.
 * - Every named permission used by hooks, loads, APIs, and server actions.
 * - Role inheritance, role ranking, and "view as lower role" behavior.
 * - Browser-safe boolean permission snapshots computed on the server.
 *
 * How to add a new permission:
 * 1. Add a new `PERMISSIONS.MY_PERMISSION_NAME` entry using ALL_CAPS + underscores.
 * 2. Add that permission to one or more role definitions below.
 * 3. Use `hasPermission`, `requirePermission`, or a server-built permission snapshot.
 *
 * How to add a new role:
 * 1. Add a role entry to `DEFAULT_ROLE_DEFINITIONS`.
 * 2. Set a `label` and numeric `rank`.
 * 3. Add `inherits` if the role should include another role's permissions.
 * 4. Add any extra `permissions` granted only by that role.
 *
 * Role inheritance:
 * - A role may inherit one or more lower roles.
 * - Inherited permissions are merged recursively.
 * - Validation fails fast for unknown roles, unknown permissions, cycles, or duplicate entries.
 *
 * Security warning:
 * - Do not import this file directly into client runtime code.
 * - Client UI should only receive server-computed boolean snapshots, never the registry itself.
 */

import type { RequestEvent } from '@sveltejs/kit';

export const PERMISSIONS = {
	VIEW_DASHBOARD_HOME: 'VIEW_DASHBOARD_HOME', // allows access to the main dashboard landing page
	VIEW_SCHEDULE: 'VIEW_SCHEDULE', // allows access to schedule pages and schedule navigation
	VIEW_OFFERINGS: 'VIEW_OFFERINGS', // allows access to offerings pages and offerings navigation
	VIEW_CLUB_SPORTS: 'VIEW_CLUB_SPORTS', // allows club sports navigation visibility
	VIEW_MEMBER_MANAGEMENT: 'VIEW_MEMBER_MANAGEMENT', // allows access to member management pages
	VIEW_COMMUNICATION_CENTER: 'VIEW_COMMUNICATION_CENTER', // allows communication center navigation visibility
	VIEW_FACILITIES: 'VIEW_FACILITIES', // allows access to facilities pages and facilities navigation
	VIEW_EQUIPMENT_CHECKOUT: 'VIEW_EQUIPMENT_CHECKOUT', // allows equipment checkout navigation visibility
	VIEW_PAYMENTS: 'VIEW_PAYMENTS', // allows payments navigation visibility
	VIEW_FORMS: 'VIEW_FORMS', // allows forms navigation visibility
	VIEW_REPORTS: 'VIEW_REPORTS', // allows reports navigation visibility
	VIEW_SETTINGS: 'VIEW_SETTINGS', // allows access to dashboard settings routes
	VIEW_ACCOUNT: 'VIEW_ACCOUNT', // allows access to the account page
	VIEW_NOTIFICATIONS: 'VIEW_NOTIFICATIONS', // allows access to notifications routes and buttons
	ACCESS_DEV_TOOLS: 'ACCESS_DEV_TOOLS', // allows access to developer-only pages and tools
	VIEW_AS_ROLE: 'VIEW_AS_ROLE', // allows switching into a lower role view mode
	CREATE_ORGANIZATION: 'CREATE_ORGANIZATION', // allows creating a new organization membership context
	EDIT_ORGANIZATION_DETAILS: 'EDIT_ORGANIZATION_DETAILS', // allows editing organization settings and metadata
	SET_DEFAULT_ORGANIZATION: 'SET_DEFAULT_ORGANIZATION', // allows setting a default organization for the user
	LEAVE_ORGANIZATION: 'LEAVE_ORGANIZATION', // allows leaving an organization membership when safe
	EDIT_NAVIGATION_SETTINGS: 'EDIT_NAVIGATION_SETTINGS', // allows editing dashboard navigation labels and order
	MANAGE_THEMES: 'MANAGE_THEMES', // allows editing theme routes and theme configuration
	USE_ADDRESS_SUGGEST: 'USE_ADDRESS_SUGGEST', // allows using the protected address suggestion endpoint
	MANAGE_FACILITIES: 'MANAGE_FACILITIES', // allows creating, updating, archiving, restoring, and deleting facilities
	MANAGE_OFFERINGS: 'MANAGE_OFFERINGS', // allows creating and updating offerings, leagues, divisions, and seasons
	EDIT_LEAGUE_ROWS: 'EDIT_LEAGUE_ROWS', // allows elevated league row editing actions reserved above normal operations
	DELETE_SEASONS: 'DELETE_SEASONS', // allows deleting seasons and other destructive season-lifecycle actions
	ADD_MEMBER: 'ADD_MEMBER', // allows adding or inviting members to an organization
	EDIT_MEMBER_PROFILE: 'EDIT_MEMBER_PROFILE', // allows editing member profile fields
	CHANGE_MEMBER_ROLE: 'CHANGE_MEMBER_ROLE', // allows changing another member's organization role
	REMOVE_MEMBER: 'REMOVE_MEMBER', // allows removing another member from an organization
	MANAGE_MEMBER_INVITES: 'MANAGE_MEMBER_INVITES' // allows regenerating or revoking member invites
} as const;

export type AuthPermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

type PermissionRegistryInput = {
	permissions: Record<string, string>;
	roles: Record<
		string,
		{
			label: string;
			rank: number;
			inherits?: string[];
			permissions: string[];
		}
	>;
};

type PermissionRegistry = {
	permissions: Record<string, string>;
	permissionValues: AuthPermission[];
	permissionSet: Set<string>;
	roles: Record<
		string,
		{
			label: string;
			rank: number;
			inherits: string[];
			permissions: AuthPermission[];
		}
	>;
	roleValues: string[];
	roleSet: Set<string>;
	roleLabels: Record<string, string>;
	resolvedPermissionMap: Map<string, Set<AuthPermission>>;
};

const DEFAULT_ROLE_DEFINITIONS = {
	participant: {
		label: 'Participant',
		rank: 0,
		permissions: [
			PERMISSIONS.VIEW_DASHBOARD_HOME,
			PERMISSIONS.VIEW_SCHEDULE,
			PERMISSIONS.VIEW_OFFERINGS,
			PERMISSIONS.VIEW_CLUB_SPORTS,
			PERMISSIONS.VIEW_COMMUNICATION_CENTER,
			PERMISSIONS.VIEW_EQUIPMENT_CHECKOUT,
			PERMISSIONS.VIEW_ACCOUNT,
			PERMISSIONS.VIEW_NOTIFICATIONS,
			PERMISSIONS.SET_DEFAULT_ORGANIZATION,
			PERMISSIONS.LEAVE_ORGANIZATION
		]
	},
	manager: {
		label: 'Manager',
		rank: 1,
		inherits: ['participant'],
		permissions: [
			PERMISSIONS.VIEW_AS_ROLE,
			PERMISSIONS.VIEW_MEMBER_MANAGEMENT,
			PERMISSIONS.VIEW_FACILITIES,
			PERMISSIONS.VIEW_PAYMENTS,
			PERMISSIONS.VIEW_FORMS,
			PERMISSIONS.VIEW_REPORTS,
			PERMISSIONS.VIEW_SETTINGS,
			PERMISSIONS.EDIT_NAVIGATION_SETTINGS,
			PERMISSIONS.MANAGE_THEMES,
			PERMISSIONS.USE_ADDRESS_SUGGEST,
			PERMISSIONS.MANAGE_FACILITIES,
			PERMISSIONS.MANAGE_OFFERINGS
		]
	},
	admin: {
		label: 'Admin',
		rank: 2,
		inherits: ['manager'],
		permissions: [
			PERMISSIONS.VIEW_AS_ROLE,
			PERMISSIONS.CREATE_ORGANIZATION,
			PERMISSIONS.EDIT_ORGANIZATION_DETAILS,
			PERMISSIONS.DELETE_SEASONS,
			PERMISSIONS.ADD_MEMBER,
			PERMISSIONS.EDIT_MEMBER_PROFILE,
			PERMISSIONS.CHANGE_MEMBER_ROLE,
			PERMISSIONS.REMOVE_MEMBER,
			PERMISSIONS.MANAGE_MEMBER_INVITES
		]
	},
	dev: {
		label: 'Dev',
		rank: 3,
		inherits: ['admin'],
		permissions: [PERMISSIONS.ACCESS_DEV_TOOLS, PERMISSIONS.EDIT_LEAGUE_ROWS]
	}
} as const satisfies PermissionRegistryInput['roles'];

export const ROLE_VALUES = ['participant', 'manager', 'admin', 'dev'] as const;
export type AuthRole = (typeof ROLE_VALUES)[number];

export const createPermissionRegistry = (input: PermissionRegistryInput): PermissionRegistry => {
	const permissionValues = Object.values(input.permissions);
	const permissionSet = new Set(permissionValues);
	if (permissionSet.size !== permissionValues.length) {
		throw new Error('Permission registry contains duplicate permission values.');
	}

	const roles: PermissionRegistry['roles'] = {};
	for (const [roleName, definition] of Object.entries(input.roles)) {
		const inherits = definition.inherits ?? [];
		if (!Array.isArray(inherits)) {
			throw new Error(`Role "${roleName}" must provide "inherits" as an array.`);
		}

		const rolePermissionSet = new Set<string>();
		for (const permission of definition.permissions) {
			if (!permissionSet.has(permission)) {
				throw new Error(`Role "${roleName}" references unknown permission "${permission}".`);
			}
			if (rolePermissionSet.has(permission)) {
				throw new Error(`Role "${roleName}" contains duplicate permission "${permission}".`);
			}
			rolePermissionSet.add(permission);
		}

		roles[roleName] = {
			label: definition.label,
			rank: definition.rank,
			inherits,
			permissions: [...rolePermissionSet] as AuthPermission[]
		};
	}

	const roleValues = Object.keys(roles).sort((a, b) => roles[a].rank - roles[b].rank);
	const roleSet = new Set(roleValues);
	for (const roleName of roleValues) {
		for (const inheritedRole of roles[roleName].inherits) {
			if (!roleSet.has(inheritedRole)) {
				throw new Error(`Role "${roleName}" references unknown inherited role "${inheritedRole}".`);
			}
		}
	}

	const resolvedPermissionMap = new Map<string, Set<AuthPermission>>();
	const visitState = new Map<string, 'visiting' | 'visited'>();
	const resolveRolePermissions = (roleName: string): Set<AuthPermission> => {
		const state = visitState.get(roleName);
		if (state === 'visiting') {
			throw new Error(`Circular role inheritance detected at role "${roleName}".`);
		}
		if (state === 'visited') {
			return new Set(resolvedPermissionMap.get(roleName) ?? []);
		}

		const role = roles[roleName];
		if (!role) {
			throw new Error(`Unknown role "${roleName}".`);
		}

		visitState.set(roleName, 'visiting');
		const resolved = new Set<AuthPermission>(role.permissions);
		for (const inheritedRole of role.inherits) {
			for (const permission of resolveRolePermissions(inheritedRole)) {
				resolved.add(permission);
			}
		}
		visitState.set(roleName, 'visited');
		resolvedPermissionMap.set(roleName, resolved);
		return new Set(resolved);
	};

	for (const roleName of roleValues) {
		resolveRolePermissions(roleName);
	}

	const roleLabels = Object.fromEntries(
		roleValues.map((roleName) => [roleName, roles[roleName].label])
	);

	return {
		permissions: input.permissions,
		permissionValues: permissionValues as AuthPermission[],
		permissionSet,
		roles,
		roleValues,
		roleSet,
		roleLabels,
		resolvedPermissionMap
	};
};

const REGISTRY = createPermissionRegistry({
	permissions: PERMISSIONS,
	roles: DEFAULT_ROLE_DEFINITIONS as unknown as PermissionRegistryInput['roles']
});

if (
	REGISTRY.roleValues.length !== ROLE_VALUES.length ||
	ROLE_VALUES.some((role) => !REGISTRY.roleSet.has(role))
) {
	throw new Error('ROLE_VALUES does not match the configured permission registry roles.');
}

export const ROLE_LABELS = REGISTRY.roleLabels as Record<AuthRole, string>;

export const MEMBER_ASSIGNABLE_ROLE_VALUES = ['participant', 'manager', 'admin'] as const;
export type MemberAssignableRole = (typeof MEMBER_ASSIGNABLE_ROLE_VALUES)[number];
export const DASHBOARD_ALLOWED_ROLES: readonly AuthRole[] = ['manager', 'admin', 'dev'];
export const ADMIN_LIKE_ROLES: readonly AuthRole[] = ['admin', 'dev'];
export const VIEW_AS_ROLE_ALLOWED_ROLES: readonly AuthRole[] = ['manager', 'admin', 'dev'];

export type PermissionSnapshot = Record<AuthPermission, boolean>;

const DEFAULT_ROLE: AuthRole = 'participant';

export const normalizeRole = (value: string | null | undefined): AuthRole => {
	if (!value) {
		return DEFAULT_ROLE;
	}

	const normalized = value.trim().toLowerCase();
	return REGISTRY.roleSet.has(normalized) ? (normalized as AuthRole) : DEFAULT_ROLE;
};

export const normalizeRoleOrNull = (value: string | null | undefined): AuthRole | null => {
	if (!value) {
		return null;
	}

	const normalized = value.trim().toLowerCase();
	return REGISTRY.roleSet.has(normalized) ? (normalized as AuthRole) : null;
};

export const hasAnyRole = (
	role: string | null | undefined,
	allowedRoles: readonly AuthRole[]
): boolean => {
	const normalized = normalizeRole(role);
	return allowedRoles.includes(normalized);
};

export const getRoleLabel = (role: string | null | undefined): string =>
	ROLE_LABELS[normalizeRole(role)];

export const getRoleRank = (role: string | null | undefined): number =>
	REGISTRY.roles[normalizeRole(role)].rank;

export const getRolePermissions = (role: string | null | undefined): ReadonlySet<AuthPermission> =>
	new Set(REGISTRY.resolvedPermissionMap.get(normalizeRole(role)) ?? []);

export const hasPermission = (
	role: string | null | undefined,
	permission: AuthPermission
): boolean => getRolePermissions(role).has(permission);

export const hasAnyPermission = (
	role: string | null | undefined,
	permissions: readonly AuthPermission[]
): boolean => permissions.some((permission) => hasPermission(role, permission));

export const buildPermissionSnapshot = (role: string | null | undefined): PermissionSnapshot => {
	const rolePermissions = getRolePermissions(role);
	const snapshot = {} as PermissionSnapshot;
	for (const permission of REGISTRY.permissionValues) {
		snapshot[permission] = rolePermissions.has(permission);
	}
	return Object.freeze(snapshot) as PermissionSnapshot;
};

export const getPermissionSnapshot = buildPermissionSnapshot;

export const canViewAsRole = (role: string | null | undefined): boolean =>
	hasPermission(role, PERMISSIONS.VIEW_AS_ROLE);

export const canViewAsLowerRole = (
	baseRole: string | null | undefined,
	targetRole: string | null | undefined
): boolean => {
	const normalizedBaseRole = normalizeRole(baseRole);
	const normalizedTargetRole = normalizeRoleOrNull(targetRole);
	if (!normalizedTargetRole) {
		return false;
	}

	return (
		canViewAsRole(normalizedBaseRole) &&
		getRoleRank(normalizedTargetRole) < getRoleRank(normalizedBaseRole)
	);
};

export const getViewAsRoleTargets = (role: string | null | undefined): AuthRole[] => {
	const normalizedRole = normalizeRole(role);
	const baseRank = getRoleRank(normalizedRole);
	return [...ROLE_VALUES]
		.filter((candidate) => getRoleRank(candidate) < baseRank)
		.sort((a, b) => getRoleRank(b) - getRoleRank(a));
};

export const isAdminLikeRole = (role: string | null | undefined): boolean =>
	hasPermission(role, PERMISSIONS.CHANGE_MEMBER_ROLE);

export const isDevRole = (role: string | null | undefined): boolean =>
	hasPermission(role, PERMISSIONS.ACCESS_DEV_TOOLS);

type PermissionCheckOptions = {
	mutate?: boolean;
	useBaseRoleForRead?: boolean;
};

export const resolveRoleForPermissionCheck = (
	locals: App.Locals,
	options?: PermissionCheckOptions
): AuthRole => {
	const useBaseRoleForRead = options?.useBaseRoleForRead ?? true;
	if (options?.mutate) {
		return normalizeRole(locals.user?.role ?? locals.user?.baseRole);
	}

	if (useBaseRoleForRead) {
		return normalizeRole(locals.user?.baseRole ?? locals.user?.role);
	}

	return normalizeRole(locals.user?.role ?? locals.user?.baseRole);
};

export const hasLocalsPermission = (
	locals: App.Locals,
	permission: AuthPermission,
	options?: PermissionCheckOptions
): boolean => hasPermission(resolveRoleForPermissionCheck(locals, options), permission);

export const hasLocalsAnyPermission = (
	locals: App.Locals,
	permissions: readonly AuthPermission[],
	options?: PermissionCheckOptions
): boolean => permissions.some((permission) => hasLocalsPermission(locals, permission, options));

export const requirePermission = (
	locals: App.Locals,
	permission: AuthPermission,
	options?: PermissionCheckOptions
): boolean => hasLocalsPermission(locals, permission, options);

export const canManageWrites = (locals: App.Locals): boolean =>
	hasLocalsAnyPermission(
		locals,
		[
			PERMISSIONS.MANAGE_FACILITIES,
			PERMISSIONS.MANAGE_OFFERINGS,
			PERMISSIONS.EDIT_NAVIGATION_SETTINGS,
			PERMISSIONS.MANAGE_THEMES,
			PERMISSIONS.CREATE_ORGANIZATION
		],
		{ mutate: true }
	);

export const buildAuthRoleContext = (input: {
	baseRole: string | null | undefined;
	requestedViewAsRole: string | null | undefined;
}) => {
	const baseRole = normalizeRole(input.baseRole);
	const requestedViewAsRole = normalizeRoleOrNull(input.requestedViewAsRole);
	const canViewAsRoleEnabled = canViewAsRole(baseRole);
	const viewAsRole =
		canViewAsRoleEnabled &&
		requestedViewAsRole !== null &&
		canViewAsLowerRole(baseRole, requestedViewAsRole)
			? requestedViewAsRole
			: null;
	const isViewingAsRole = viewAsRole !== null;
	const role = viewAsRole ?? baseRole;

	return {
		baseRole,
		canViewAsRole: canViewAsRoleEnabled,
		isViewingAsRole,
		viewAsRole,
		role
	};
};

export const applyMembershipRoleToLocals = (
	event: Pick<RequestEvent, 'locals'>,
	input: {
		clientId: string;
		baseRole: string | null | undefined;
		requestedViewAsRole?: string | null | undefined;
	}
) => {
	const roleContext = buildAuthRoleContext({
		baseRole: input.baseRole,
		requestedViewAsRole: input.requestedViewAsRole ?? null
	});

	if (event.locals.session) {
		event.locals.session = {
			...event.locals.session,
			clientId: input.clientId,
			activeClientId: input.clientId,
			role: roleContext.role,
			baseRole: roleContext.baseRole,
			canViewAsRole: roleContext.canViewAsRole,
			isViewingAsRole: roleContext.isViewingAsRole,
			viewAsRole: roleContext.viewAsRole
		};
	}

	if (event.locals.user) {
		event.locals.user = {
			...event.locals.user,
			clientId: input.clientId,
			role: roleContext.role,
			baseRole: roleContext.baseRole,
			canViewAsRole: roleContext.canViewAsRole,
			isViewingAsRole: roleContext.isViewingAsRole,
			viewAsRole: roleContext.viewAsRole
		};
	}

	return roleContext;
};

export const getMemberAssignableRoleOptions = (): Array<{
	value: MemberAssignableRole;
	label: string;
}> =>
	MEMBER_ASSIGNABLE_ROLE_VALUES.map((role) => ({
		value: role,
		label: ROLE_LABELS[role]
	}));

export const getOrganizationMembershipRoleOptions = (): Array<{
	value: MemberAssignableRole;
	label: string;
}> => getMemberAssignableRoleOptions();
