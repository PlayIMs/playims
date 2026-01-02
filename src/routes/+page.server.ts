import { DatabaseOperations } from '$lib/database';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	try {
		// Create Drizzle database operations instance
		const dbOps = new DatabaseOperations(platform || { env: {} } as any);

		// Determine environment
		// In Cloudflare Pages, platform.env.DB exists in both local (wrangler pages dev) and production.
		// However, dev mode typically has a specific flag or we can check NODE_ENV.
		// For now, if we have platform.env.DB, we are likely in a Cloudflare environment (local or prod).
		// The previous logic was inverted.
		const isCloudflareEnv = !!platform?.env?.DB;
		
		// To truly detect local dev vs prod in Pages, we often check specific vars or the absence of CF properties.
		// But for the purpose of "is this the fallback mode?", the logic below is safer:
		const environment = isCloudflareEnv ? 'cloudflare (local or prod)' : 'local (vite only)';
		const isDevelopment = process.env.NODE_ENV === 'development';

		// Fetch data from both tables using Drizzle operations
		const [clients, users] = await Promise.all([dbOps.clients.getAll(), dbOps.users.getAll()]);

		console.log(`Drizzle database query results (${environment}):`, {
			environment,
			clientsCount: clients.length,
			usersCount: users.length,
			clients: clients.slice(0, 3), // Log first 3 clients for debugging
			users: users.slice(0, 3) // Log first 3 users for debugging
		});

		return {
			clients,
			users,
			environment,
			isDevelopment
		};
	} catch (error) {
		console.error('Drizzle database query error:', error);

		// Return empty arrays if there's an error
		return {
			clients: [],
			users: [],
			error: error instanceof Error ? error.message : 'Failed to fetch data from database',
			environment: 'error',
			isDevelopment: false
		};
	}
};
