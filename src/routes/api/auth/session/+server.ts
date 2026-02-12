import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Authenticated endpoint: returns safe session/user data for UI hydration.
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user || !locals.session) {
		return json({ success: false, error: 'Authentication required.' }, { status: 401 });
	}

	let memberships: { clientId: string; role: string; isDefault: boolean }[] = [];
	if (platform?.env?.DB) {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		const activeMemberships = await dbOps.userClients.listActiveForUser(locals.user.id);
		memberships = activeMemberships.map((membership) => ({
			clientId: membership.clientId,
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
