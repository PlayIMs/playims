// Database library exports
export { createDatabaseConnection } from './connection.js';
export type { Client, User, DatabaseConnection, QueryResult } from './types.js';

/**
 * Database usage example:
 *
 * In a server-side load function or API route:
 *
 * import { createDatabaseConnection } from '$lib/database';
 *
 * export async function load({ platform }) {
 *   const db = createDatabaseConnection(platform);
 *
 *   const clients = await db.clients.getAll();
 *   const users = await db.users.getAll();
 *
 *   return {
 *     clients,
 *     users
 *   };
 * }
 *
 * In an API endpoint:
 *
 * import { createDatabaseConnection } from '$lib/database';
 * import { json } from '@sveltejs/kit';
 *
 * export async function GET({ platform }) {
 *   const db = createDatabaseConnection(platform);
 *   const clients = await db.clients.getAll();
 *   return json(clients);
 * }
 */
