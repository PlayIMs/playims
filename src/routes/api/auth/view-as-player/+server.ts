import { canViewAsPlayerRole, normalizeRole } from '$lib/server/auth/rbac';
import { viewAsPlayerSchema } from '$lib/server/auth/validation';
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

	const parsed = viewAsPlayerSchema.safeParse(body);
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const baseRole = normalizeRole(
		event.locals.session.baseRole ??
			event.locals.user.baseRole ??
			event.locals.session.role ??
			event.locals.user.role
	);
	const canViewAsPlayer = canViewAsPlayerRole(baseRole);
	if (parsed.data.enabled && !canViewAsPlayer) {
		return json(
			{ success: false, error: 'You are not allowed to enable player view mode.' },
			{ status: 403 }
		);
	}

	const dbOps = getCentralDbOps(event);
	const nowIso = new Date().toISOString();
	const updatedSession = await dbOps.sessions.setViewAsPlayer(
		event.locals.session.id,
		parsed.data.enabled,
		nowIso
	);
	if (!updatedSession) {
		return json({ success: false, error: 'Failed to update view mode.' }, { status: 500 });
	}

	const isViewingAsPlayer = canViewAsPlayer && parsed.data.enabled;
	const role = isViewingAsPlayer ? 'player' : baseRole;

	event.locals.session = {
		...event.locals.session,
		role,
		baseRole,
		canViewAsPlayer,
		isViewingAsPlayer
	};
	event.locals.user = {
		...event.locals.user,
		role,
		baseRole,
		canViewAsPlayer,
		isViewingAsPlayer
	};

	return json({
		success: true,
		data: {
			user: event.locals.user,
			session: event.locals.session
		}
	});
};
