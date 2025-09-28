import { createDatabaseConnection } from '$lib/database';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	try {
		// Create database connection (works for both local wrangler and production REST API)
		const db = createDatabaseConnection(platform);

		// Determine environment
		const isLocalDevelopment = platform?.env?.DB;
		const environment = isLocalDevelopment ? 'local (wrangler)' : 'production (REST API)';

		// Fetch data from both tables
		const [clients, users] = await Promise.all([db.clients.getAll(), db.users.getAll()]);

		console.log(`Database query results (${environment}):`, {
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
		console.error('Database query error:', error);

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
