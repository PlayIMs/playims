import { DatabaseOperations } from '$lib/database';
import { logRequestSummary, nowMs } from '$lib/server/request-logger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const startedAt = nowMs();

	try {
		// Create Drizzle database operations instance
		const dbOps = new DatabaseOperations(platform || ({ env: {} } as any));

		// Determine environment
		// In Cloudflare Pages, platform.env.DB exists in both local (wrangler pages dev) and production.
		// However, dev mode typically has a specific flag or we can check NODE_ENV.
		// For now, if we have platform.env.DB, we are likely in a Cloudflare environment (local or prod).
		// The previous logic was inverted.
		const isCloudflareEnv = !!platform?.env?.DB;

		// To truly detect local dev vs prod in Pages, we often check specific vars or the absence of CF properties.
		// But for the purpose of "is this the fallback mode?", the logic below is safer:
		let environment = isCloudflareEnv ? 'cloudflare (local or prod)' : 'local (vite only)';
		const isDevelopment = process.env.NODE_ENV === 'development';

		if (isCloudflareEnv) {
			// try to detect specific database if possible, or just refine the label
			// The binding itself doesn't always expose the name directly in code,
			// but we can infer from the process or hostname if needed.
			// For now, let's trust the logic: if isDevelopment is true + CF env, it's "Wrangler Local".
			// If isDevelopment is false + CF env, it's "Cloudflare Production".
			if (isDevelopment) {
				environment = 'Cloudflare Local (Wrangler)';
			} else {
				environment = 'Cloudflare Production';
			}
		} else {
			environment = 'Localhost (Vite - No DB Binding)';
		}

		// Fetch data from both tables using Drizzle operations
		const [clients, users] = await Promise.all([dbOps.clients.getAll(), dbOps.users.getAll()]);

		logRequestSummary({
			scope: 'SSR',
			method: 'LOAD',
			endpoint: '/',
			table: 'clients,users',
			recordCount: clients.length + users.length,
			status: 200,
			durationMs: nowMs() - startedAt
		});

		return {
			clients,
			users,
			environment,
			dbName: isDevelopment ? 'playims-central-db-dev' : 'playims-central-db-prod',
			isDevelopment
		};
	} catch (error) {
		logRequestSummary({
			scope: 'SSR',
			method: 'LOAD',
			endpoint: '/',
			table: 'clients,users',
			recordCount: 0,
			status: 500,
			durationMs: nowMs() - startedAt,
			error: error instanceof Error ? error.message : 'Failed to fetch data from database'
		});

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
