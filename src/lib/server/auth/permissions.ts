import { DASHBOARD_ALLOWED_ROLES, hasAnyRole } from './rbac';

export const canManageWrites = (locals: App.Locals): boolean =>
	hasAnyRole(locals.user?.role, DASHBOARD_ALLOWED_ROLES);
