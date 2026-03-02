import { error, redirect } from '@sveltejs/kit';
import { isDevRole } from '$lib/server/auth/rbac';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/log-in');
	}

	if (!isDevRole(locals.user.role)) {
		throw error(403, 'Developer access required.');
	}

	return {};
};
