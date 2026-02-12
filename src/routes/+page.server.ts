import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (locals.user && locals.session) {
		throw redirect(303, '/dashboard');
	}

	try {
		const isCloudflareEnv = !!platform?.env?.DB;
		let environment = isCloudflareEnv ? 'cloudflare (local or prod)' : 'local (vite only)';
		const isDevelopment = process.env.NODE_ENV === 'development';

		if (isCloudflareEnv) {
			if (isDevelopment) {
				environment = 'Cloudflare Local (Wrangler)';
			} else {
				environment = 'Cloudflare Production';
			}
		} else {
			environment = 'Localhost (Vite - No DB Binding)';
		}

		return {
			environment,
			dbName: isDevelopment ? 'playims-central-db-dev' : 'playims-central-db-prod',
			isDevelopment
		};
	} catch (error) {
		return {
			error: 'Failed to determine environment details',
			environment: 'error',
			isDevelopment: false
		};
	}
};
