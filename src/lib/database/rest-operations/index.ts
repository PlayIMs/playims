// REST API operations for production (Vercel) deployment
// Uses D1 HTTP API instead of direct D1 binding

import { D1RestClient } from '../d1-client.js';
import { ClientRestOperations } from './clients.js';
import { UserRestOperations } from './users.js';

/**
 * Database operations using D1 REST API
 * Used when platform.env.DB is not available (Vercel deployment)
 */
export class RestDatabaseOperations {
	public clients: ClientRestOperations;
	public users: UserRestOperations;
	// Add other table operations as needed (sports, leagues, divisions, teams, rosters)

	constructor() {
		const client = new D1RestClient();

		this.clients = new ClientRestOperations(client);
		this.users = new UserRestOperations(client);
	}
}
