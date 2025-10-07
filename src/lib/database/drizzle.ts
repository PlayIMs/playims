// Drizzle database client for Cloudflare D1
import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema.js';

// Platform interface for local development with wrangler
interface Platform {
	env?: {
		DB?: D1Database;
	};
}

/**
 * Creates a Drizzle database client
 * Works in both local development (with wrangler) and production (with D1 REST API)
 * @param platform - Optional SvelteKit platform object for local development
 * @returns Drizzle database instance
 */
export function createDrizzleClient(platform?: Platform) {
	if (platform?.env?.DB) {
		// Local development with wrangler - direct D1 connection
		return drizzle(platform.env.DB, { schema });
	} else {
		// Production mode - we'll need to create a custom D1 adapter for REST API
		// For now, we'll throw an error and provide instructions for REST API setup
		throw new Error(
			'Production D1 REST API support requires additional setup. ' +
				'Use wrangler pages dev for local development with Drizzle.'
		);
	}
}

// Export schema for use in queries
export { schema };
