import { error, redirect } from '@sveltejs/kit';
import { hasPermission, PERMISSIONS } from '$lib/server/auth/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/log-in');
	}

	if (!hasPermission(locals.user.role, PERMISSIONS.ACCESS_DEV_TOOLS)) {
		throw error(403, 'Developer access required.');
	}

	return {};
};
