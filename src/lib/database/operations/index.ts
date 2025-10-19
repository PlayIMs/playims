// Database operations - REST API only (raw SQL)
// Simplified to use only D1 REST API for maximum efficiency

import { D1RestClient } from '../d1-client.js';
import { ClientOperations } from './clients.js';
import { UserOperations } from './users.js';
import { SportOperations } from './sports.js';
import { LeagueOperations } from './leagues.js';
import { DivisionOperations } from './divisions.js';
import { TeamOperations } from './teams.js';
import { RosterOperations } from './rosters.js';

/**
 * Unified database operations class
 * Uses only D1 REST API (raw SQL) for maximum simplicity and efficiency
 * No more dual code paths - just clean, simple SQL operations
 */
export class DatabaseOperations {
	public clients: ClientOperations;
	public users: UserOperations;
	public sports: SportOperations;
	public leagues: LeagueOperations;
	public divisions: DivisionOperations;
	public teams: TeamOperations;
	public rosters: RosterOperations;

	constructor() {
		// Always use REST API client
		const db = new D1RestClient();

		// All operation classes use only raw SQL
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
