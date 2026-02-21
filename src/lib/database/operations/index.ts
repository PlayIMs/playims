// Database operations - Drizzle ORM
// Fully typed database operations using Cloudflare D1

import { createDrizzleClient } from '../drizzle.js';
import type { D1Database } from '@cloudflare/workers-types';
import { ClientOperations } from './clients.js';
import { UserOperations } from './users.js';
import { OfferingOperations } from './offerings.js';
import { SeasonOperations } from './seasons.js';
import { LeagueOperations } from './leagues.js';
import { DivisionOperations } from './divisions.js';
import { TeamOperations } from './teams.js';
import { RosterOperations } from './rosters.js';
import { EventOperations } from './events.js';
import { FacilityOperations } from './facilities.js';
import { FacilityAreaOperations } from './facility-areas.js';
import { AnnouncementOperations } from './announcements.js';
import { ThemeOperations } from './themes.js';
import { SessionOperations } from './sessions.js';
import { UserClientOperations } from './user-clients.js';
import { ClientDatabaseRouteOperations } from './client-database-routes.js';
import { SignupInviteKeyOperations } from './signup-invite-keys.js';
import { AuthRateLimitOperations } from './auth-rate-limits.js';

/**
 * Unified database operations class
 * Uses Drizzle ORM for type safety and Cloudflare D1 binding
 */
export class DatabaseOperations {
	public clients: ClientOperations;
	public users: UserOperations;
	public offerings: OfferingOperations;
	public seasons: SeasonOperations;
	public leagues: LeagueOperations;
	public divisions: DivisionOperations;
	public teams: TeamOperations;
	public rosters: RosterOperations;
	public events: EventOperations;
	public facilities: FacilityOperations;
	public facilityAreas: FacilityAreaOperations;
	public announcements: AnnouncementOperations;
	public themes: ThemeOperations;
	public sessions: SessionOperations;
	public userClients: UserClientOperations;
	public clientDatabaseRoutes: ClientDatabaseRouteOperations;
	public signupInviteKeys: SignupInviteKeyOperations;
	public authRateLimits: AuthRateLimitOperations;

	constructor(platformOrDb: { env: { DB: D1Database } } | D1Database) {
		let db: D1Database;

		// Handle null/undefined platform in case of error
		if (!platformOrDb) {
			throw new Error(
				'DatabaseOperations requires a Platform object or D1Database binding. Ensure your Cloudflare Pages project has the D1 database binding configured.'
			);
		}

		// Handle both platform object and direct DB binding
		if ('env' in platformOrDb && platformOrDb.env && platformOrDb.env.DB) {
			db = platformOrDb.env.DB;
		} else if (platformOrDb && typeof (platformOrDb as any).prepare === 'function') {
			db = platformOrDb as D1Database;
		} else {
			throw new Error(
				'DatabaseOperations requires a D1Database binding or Platform object. platform.env.DB was undefined.'
			);
		}

		const drizzleDb = createDrizzleClient(db);

		this.clients = new ClientOperations(drizzleDb);
		this.users = new UserOperations(drizzleDb);
		this.offerings = new OfferingOperations(drizzleDb);
		this.seasons = new SeasonOperations(drizzleDb);
		this.leagues = new LeagueOperations(drizzleDb);
		this.divisions = new DivisionOperations(drizzleDb);
		this.teams = new TeamOperations(drizzleDb);
		this.rosters = new RosterOperations(drizzleDb);
		this.events = new EventOperations(drizzleDb);
		this.facilities = new FacilityOperations(drizzleDb);
		this.facilityAreas = new FacilityAreaOperations(drizzleDb);
		this.announcements = new AnnouncementOperations(drizzleDb);
		this.themes = new ThemeOperations(drizzleDb);
		this.sessions = new SessionOperations(drizzleDb);
		this.userClients = new UserClientOperations(drizzleDb);
		this.clientDatabaseRoutes = new ClientDatabaseRouteOperations(drizzleDb);
		this.signupInviteKeys = new SignupInviteKeyOperations(drizzleDb);
		this.authRateLimits = new AuthRateLimitOperations(drizzleDb);
	}
}

// Export individual operation classes for direct use
export { ClientOperations } from './clients.js';
export { UserOperations } from './users.js';
export { OfferingOperations } from './offerings.js';
export { SeasonOperations } from './seasons.js';
export { LeagueOperations } from './leagues.js';
export { DivisionOperations } from './divisions.js';
export { TeamOperations } from './teams.js';
export { RosterOperations } from './rosters.js';
export { EventOperations } from './events.js';
export { FacilityOperations } from './facilities.js';
export { FacilityAreaOperations } from './facility-areas.js';
export { AnnouncementOperations } from './announcements.js';
export { ThemeOperations } from './themes.js';
export { SessionOperations } from './sessions.js';
export { UserClientOperations } from './user-clients.js';
export { ClientDatabaseRouteOperations } from './client-database-routes.js';
export { SignupInviteKeyOperations } from './signup-invite-keys.js';
export { AuthRateLimitOperations } from './auth-rate-limits.js';
