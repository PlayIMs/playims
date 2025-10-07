// Database library exports - Drizzle ORM
export { DatabaseOperations } from './operations/index.js';
export { createDrizzleClient } from './drizzle.js';
export * as schema from './schema.js';

// Export all types from schema
export type {
	Client,
	NewClient,
	User,
	NewUser,
	Sport,
	NewSport,
	League,
	NewLeague,
	Division,
	NewDivision,
	Team,
	NewTeam,
	Roster,
	NewRoster
} from './schema.js';

/**
 * Database usage example:
 *
 * In a server-side load function:
 *
 * import { DatabaseOperations } from '$lib/database';
 * import type { PageServerLoad } from './$types';
 *
 * export const load: PageServerLoad = async ({ platform }) => {
 *   const dbOps = new DatabaseOperations(platform);
 *
 *   const clients = await dbOps.clients.getAll();
 *   const users = await dbOps.users.getAll();
 *   const leagues = await dbOps.leagues.getActive();
 *
 *   return { clients, users, leagues };
 * };
 *
 * In an API endpoint:
 *
 * import { DatabaseOperations } from '$lib/database';
 * import { json } from '@sveltejs/kit';
 * import type { RequestHandler } from './$types';
 *
 * export const GET: RequestHandler = async ({ platform }) => {
 *   const dbOps = new DatabaseOperations(platform);
 *   const teams = await dbOps.teams.getAll();
 *   return json({ success: true, data: teams });
 * };
 */
