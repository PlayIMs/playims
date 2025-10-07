// Database operations - Main entry point
// Exports all table-specific operations and a unified DatabaseOperations class
// Automatically uses Drizzle (local) or REST API (production) based on environment

import type { D1Database } from '@cloudflare/workers-types';
import { createDrizzleClient } from '../drizzle.js';
import { RestDatabaseOperations } from '../rest-operations/index.js';
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
 */
export class DatabaseOperations {
	public clients: ClientOperations | any;
	public users: UserOperations | any;
	public sports: SportOperations | any;
	public leagues: LeagueOperations | any;
	public divisions: DivisionOperations | any;
	public teams: TeamOperations | any;
	public rosters: RosterOperations | any;

	constructor(platform?: Platform) {
		const isLocalDevelopment = platform?.env?.DB;

		if (isLocalDevelopment) {
			// Local development with wrangler - use Drizzle ORM
			const db = createDrizzleClient(platform);

			this.clients = new ClientOperations(db);
			this.users = new UserOperations(db);
			this.sports = new SportOperations(db);
			this.leagues = new LeagueOperations(db);
			this.divisions = new DivisionOperations(db);
			this.teams = new TeamOperations(db);
			this.rosters = new RosterOperations(db);
		} else {
			// Production on Vercel - use D1 REST API
			const restOps = new RestDatabaseOperations();

			this.clients = restOps.clients;
			this.users = restOps.users;
			// For other tables, throw helpful error for now
			this.sports = this.createNotImplemented('sports');
			this.leagues = this.createNotImplemented('leagues');
			this.divisions = this.createNotImplemented('divisions');
			this.teams = this.createNotImplemented('teams');
			this.rosters = this.createNotImplemented('rosters');
		}
	}

	private createNotImplemented(tableName: string) {
		return new Proxy(
			{},
			{
				get() {
					throw new Error(
						`${tableName} operations not yet implemented for REST API. ` +
							`Add REST operations in src/lib/database/rest-operations/${tableName}.ts`
					);
				}
			}
		);
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
