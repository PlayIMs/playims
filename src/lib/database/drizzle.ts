// Drizzle database client for Cloudflare D1
import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema.js';

export function createDrizzleClient(db: D1Database) {
	return drizzle(db, { schema });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;
export { schema };
