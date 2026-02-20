import { normalizeRole } from '$lib/server/auth/rbac';
import { switchClientSchema } from '$lib/server/auth/validation';
import { getCentralDbOps } from '$lib/server/database/context';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Authenticated endpoint: switches active client context for the current session.
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

	const parsed = switchClientSchema.safeParse(body);
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const dbOps = getCentralDbOps(event);
	const userId = event.locals.user.id;
	const requestedClientId = parsed.data.clientId;
	const activeMembership = await dbOps.userClients.getActiveMembership(userId, requestedClientId);
	if (!activeMembership) {
		return json(
			{ success: false, error: 'You do not have access to that organization.' },
			{ status: 403 }
		);
	}

	const nowIso = new Date().toISOString();
	const updatedSession = await dbOps.sessions.updateClientContext(
		event.locals.session.id,
		requestedClientId,
		nowIso
	);
	if (!updatedSession) {
		return json({ success: false, error: 'Failed to switch client context.' }, { status: 500 });
	}

	await dbOps.userClients.setDefaultMembership(userId, requestedClientId);

	const resolvedRole = normalizeRole(activeMembership.role);
	event.locals.session = {
		...event.locals.session,
		clientId: requestedClientId,
		activeClientId: requestedClientId,
		role: resolvedRole
	};
	event.locals.user = {
		...event.locals.user,
		clientId: requestedClientId,
		role: resolvedRole
	};

	return json({
		success: true,
		data: {
			user: event.locals.user,
			session: event.locals.session
		}
	});
};
