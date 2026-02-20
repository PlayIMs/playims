import { revokeCurrentSession } from '$lib/server/auth/session';
import { getCentralDbOps } from '$lib/server/database/context';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Authenticated endpoint: revoke server session and clear browser cookie.
export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Authentication is unavailable.' }, { status: 500 });
	}

	const dbOps = getCentralDbOps(event);
	await revokeCurrentSession(event, dbOps);
	return json({ success: true, data: { loggedOut: true } });
};
