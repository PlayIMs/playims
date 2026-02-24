import { canViewAsLowerRole, canViewAsRole, normalizeRole } from '$lib/server/auth/rbac';
import { viewAsRoleSchema } from '$lib/server/auth/validation';
import { getCentralDbOps } from '$lib/server/database/context';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Authentication is unavailable.' }, { status: 500 });
	}

	if (!event.locals.user || !event.locals.session) {
		return json({ success: false, error: 'Authentication required.' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const parsed = viewAsRoleSchema.safeParse(body);
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const baseRole = normalizeRole(
		event.locals.session.baseRole ??
			event.locals.user.baseRole ??
			event.locals.session.role ??
			event.locals.user.role
	);
	const canViewAsRoleEnabled = canViewAsRole(baseRole);
	const targetRole = parsed.data.targetRole;

	if (targetRole !== null) {
		if (!canViewAsRoleEnabled) {
			return json({ success: false, error: 'You are not allowed to switch view roles.' }, { status: 403 });
		}
		if (!canViewAsLowerRole(baseRole, targetRole)) {
			return json({ success: false, error: 'You cannot switch to that role view.' }, { status: 403 });
		}
	}

	const nextViewAsRole = targetRole !== null ? targetRole : null;
	const dbOps = getCentralDbOps(event);
	const nowIso = new Date().toISOString();
	const updatedSession = await dbOps.sessions.setViewAsRole(
		event.locals.session.id,
		nextViewAsRole,
		nowIso
	);
	if (!updatedSession) {
		return json({ success: false, error: 'Failed to update view mode.' }, { status: 500 });
	}

	const isViewingAsRole = nextViewAsRole !== null;
	const role = isViewingAsRole ? nextViewAsRole : baseRole;

	event.locals.session = {
		...event.locals.session,
		role,
		baseRole,
		canViewAsRole: canViewAsRoleEnabled,
		isViewingAsRole,
		viewAsRole: nextViewAsRole
	};
	event.locals.user = {
		...event.locals.user,
		role,
		baseRole,
		canViewAsRole: canViewAsRoleEnabled,
		isViewingAsRole,
		viewAsRole: nextViewAsRole
	};

	return json({
		success: true,
		data: {
			user: event.locals.user,
			session: event.locals.session
		}
	});
};
