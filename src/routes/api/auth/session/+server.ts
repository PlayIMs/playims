import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Authenticated endpoint: returns safe session/user data for UI hydration.
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.session) {
		return json({ success: false, error: 'Authentication required.' }, { status: 401 });
	}

	return json({
		success: true,
		data: {
			user: locals.user,
			session: locals.session
		}
	});
};
