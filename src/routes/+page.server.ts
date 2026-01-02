import { DatabaseOperations } from '$lib/database';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	try {
		// Create Drizzle database operations instance
		const dbOps = new DatabaseOperations(platform || { env: {} } as any);

		// Determine environment
		// Note: platform.env.DB exists in Cloudflare Pages (both local and prod)
		const isLocalDevelopment = !platform?.env?.DB;
		const environment = platform?.env?.DB ? 'production' : 'local (fallback)';

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
			isDevelopment: isLocalDevelopment
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
