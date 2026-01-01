// Database operations - Drizzle ORM
// Fully typed database operations using Cloudflare D1

import { createDrizzleClient, type DrizzleClient } from '../drizzle.js';
import type { D1Database } from '@cloudflare/workers-types';
import { ClientOperations } from './clients.js';
import { UserOperations } from './users.js';
import { SportOperations } from './sports.js';
import { LeagueOperations } from './leagues.js';
import { DivisionOperations } from './divisions.js';
import { TeamOperations } from './teams.js';
import { RosterOperations } from './rosters.js';

/**
 * Unified database operations class
 * Uses Drizzle ORM for type safety and Cloudflare D1 binding
 */
export class DatabaseOperations {
	public clients: ClientOperations;
	public users: UserOperations;
	public sports: SportOperations;
	public leagues: LeagueOperations;
	public divisions: DivisionOperations;
	public teams: TeamOperations;
	public rosters: RosterOperations;

	constructor(platformOrDb: { env: { DB: D1Database } } | D1Database) {
		let db: D1Database;
		
		// Handle both platform object and direct DB binding
		if ('env' in platformOrDb && platformOrDb.env && platformOrDb.env.DB) {
			db = platformOrDb.env.DB;
		} else if (platformOrDb && typeof (platformOrDb as any).prepare === 'function') {
			db = platformOrDb as D1Database;
		} else {
			throw new Error('DatabaseOperations requires a D1Database binding or Platform object');
		}

		const drizzleDb = createDrizzleClient(db);

		this.clients = new ClientOperations(drizzleDb);
		this.users = new UserOperations(drizzleDb);
		this.sports = new SportOperations(drizzleDb);
		this.leagues = new LeagueOperations(drizzleDb);
		this.divisions = new DivisionOperations(drizzleDb);
		this.teams = new TeamOperations(drizzleDb);
		this.rosters = new RosterOperations(drizzleDb);
	}
}

// Export individual operation classes for direct use
export { ClientOperations } from './clients.js';
export { UserOperations } from './users.js';
export { SportOperations } from './sports.js';
export { LeagueOperations } from './leagues.js';
export { DivisionOperations } from './divisions.js';
export { TeamOperations } from './teams.js';
export { RosterOperations } from './rosters.js';
