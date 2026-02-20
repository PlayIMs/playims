import { json } from '@sveltejs/kit';
import { getCentralDbOps } from '$lib/server/database/context';
import type { RequestHandler } from './$types';

// Authenticated endpoint: returns safe session/user data for UI hydration.
export const GET: RequestHandler = async (event) => {
	const { locals, platform } = event;
	if (!locals.user || !locals.session) {
		return json({ success: false, error: 'Authentication required.' }, { status: 401 });
	}

	let memberships: {
		clientId: string;
		clientSlug: string | null;
		clientName: string | null;
		clientStatus: string | null;
		role: string;
		isDefault: boolean;
	}[] = [];
	if (platform?.env?.DB) {
		const dbOps = getCentralDbOps(event);
		const activeMemberships = await dbOps.userClients.listActiveForUserWithClientDetails(locals.user.id);
		memberships = activeMemberships.map(({ membership, client }) => ({
			clientId: membership.clientId,
			clientSlug: client?.slug ?? null,
			clientName: client?.name ?? null,
			clientStatus: client?.status ?? null,
			role: membership.role,
			isDefault: membership.isDefault === 1
		}));
	}

	return json({
		success: true,
		data: {
			user: locals.user,
			session: locals.session,
			memberships
		}
	});
};
