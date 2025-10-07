import { DatabaseOperations } from '$lib/database/operations/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	try {
		// Create Drizzle database operations instance
		const dbOps = new DatabaseOperations(platform);

		// Determine environment
		const isLocalDevelopment = platform?.env?.DB;
		const environment = isLocalDevelopment ? 'local (wrangler + drizzle)' : 'production (REST API)';

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
