import { json } from '@sveltejs/kit';
import { normalizeRole } from '$lib/server/auth/rbac';
import { joinClientSchema } from '$lib/server/auth/validation';
import { requireAuthenticatedUserId } from '$lib/server/client-context';
import { normalizeClientSlug } from '$lib/server/client-slug';
import { getCentralDbOps } from '$lib/server/database/context';
import type { RequestHandler } from './$types';

const isActiveClient = (status: string | null | undefined): boolean =>
	(status?.trim().toLowerCase() ?? 'active') === 'active';

const isActiveMembership = (status: string | null | undefined): boolean =>
	(status?.trim().toLowerCase() ?? 'active') === 'active';

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

	const parsed = joinClientSchema.safeParse(body);
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const dbOps = getCentralDbOps(event);
	const userId = requireAuthenticatedUserId(event.locals);
	let targetClient = null as Awaited<ReturnType<typeof dbOps.clients.getById>>;

	if (parsed.data.clientId) {
		targetClient = await dbOps.clients.getById(parsed.data.clientId);
	} else if (parsed.data.clientSlug) {
		const normalizedSlug = normalizeClientSlug(parsed.data.clientSlug);
		if (!normalizedSlug) {
			return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
		}
		targetClient = await dbOps.clients.getByNormalizedSlug(normalizedSlug);
	}

	if (!targetClient?.id || !isActiveClient(targetClient.status)) {
		return json({ success: false, error: 'Organization not found.' }, { status: 404 });
	}

	const existingMembership = await dbOps.userClients.getMembership(userId, targetClient.id);
	if (existingMembership && !isActiveMembership(existingMembership.status)) {
		return json(
			{
				success: false,
				error: 'Your membership for this organization is inactive. Contact an administrator.'
			},
			{ status: 403 }
		);
	}

	if (!existingMembership && targetClient.selfJoinEnabled !== 1) {
		return json(
			{
				success: false,
				error: 'This organization does not allow open self-join.'
			},
			{ status: 403 }
		);
	}

	const membership = await dbOps.userClients.ensureMembership({
		userId,
		clientId: targetClient.id,
		role: existingMembership?.role ?? 'manager',
		status: 'active',
		isDefault: true,
		updatedUser: userId,
		createdUser: userId
	});

	if (!membership) {
		return json({ success: false, error: 'Failed to join organization.' }, { status: 500 });
	}

	const nowIso = new Date().toISOString();
	const updatedSession = await dbOps.sessions.updateClientContext(
		event.locals.session.id,
		targetClient.id,
		nowIso
	);
	if (!updatedSession) {
		return json({ success: false, error: 'Failed to switch organization.' }, { status: 500 });
	}

	await dbOps.userClients.setDefaultMembership(userId, targetClient.id);

	const resolvedRole = normalizeRole(membership.role);
	event.locals.session = {
		...event.locals.session,
		clientId: targetClient.id,
		activeClientId: targetClient.id,
		role: resolvedRole
	};
	event.locals.user = {
		...event.locals.user,
		clientId: targetClient.id,
		role: resolvedRole
	};

	return json({
		success: true,
		data: {
			clientId: targetClient.id,
			clientSlug: targetClient.slug ?? null,
			clientName: targetClient.name ?? null,
			joinedNow: !existingMembership,
			role: resolvedRole,
			user: event.locals.user,
			session: event.locals.session
		}
	});
};
