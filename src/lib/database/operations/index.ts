// Database operations - Main entry point
// Exports all table-specific operations and a unified DatabaseOperations class
// Automatically uses Drizzle (local) or REST API (production) based on environment

import type { D1Database } from '@cloudflare/workers-types';
import { createDrizzleClient } from '../drizzle.js';
import { D1RestClient } from '../d1-client.js';
import { ClientOperations } from './clients.js';
import { UserOperations } from './users.js';
import { SportOperations } from './sports.js';
import { LeagueOperations } from './leagues.js';
import { DivisionOperations } from './divisions.js';
import { TeamOperations } from './teams.js';
import { RosterOperations } from './rosters.js';

// Platform interface for local development with wrangler
interface Platform {
	env?: {
		DB?: D1Database;
	};
}

/**
 * Unified database operations class
 * Automatically detects environment and uses:
 * - Drizzle ORM with D1 binding (local development with wrangler)
 * - D1 REST API (production on Vercel)
 *
 * All operation classes support both Drizzle and REST API in a single file!
 */
export class DatabaseOperations {
	public clients: ClientOperations;
	public users: UserOperations;
	public sports: SportOperations;
	public leagues: LeagueOperations;
	public divisions: DivisionOperations;
	public teams: TeamOperations;
	public rosters: RosterOperations;

	constructor(platform?: Platform) {
		const isLocalDevelopment = platform?.env?.DB;

		// Create the appropriate database client
		const db = isLocalDevelopment ? createDrizzleClient(platform) : new D1RestClient();

		// Each operation class automatically adapts to the client type
		this.clients = new ClientOperations(db);
		this.users = new UserOperations(db);
		this.sports = new SportOperations(db);
		this.leagues = new LeagueOperations(db);
		this.divisions = new DivisionOperations(db);
		this.teams = new TeamOperations(db);
		this.rosters = new RosterOperations(db);
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
