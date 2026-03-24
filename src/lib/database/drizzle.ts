// Drizzle database client for Cloudflare D1
import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema/index.js';

/** Matches drizzle `DrizzleConfig['logger']` — boolean or custom logger. */
export type DrizzleClientLogger = boolean | { logQuery(query: string, params?: unknown[]): void };

export type CreateDrizzleClientOptions = {
	logger?: DrizzleClientLogger;
};

export function createDrizzleClient(db: D1Database, options?: CreateDrizzleClientOptions) {
	return drizzle(db, {
		schema,
		...(options?.logger !== undefined ? { logger: options.logger } : {})
	});
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;
export { schema };
