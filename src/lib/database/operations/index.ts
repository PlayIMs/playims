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
import { EventOperations } from './events.js';
import { FacilityOperations } from './facilities.js';
import { FacilityAreaOperations } from './facility-areas.js';
import { SportOfficialOperations } from './sport-officials.js';
import { DivisionStandingOperations } from './division-standings.js';
import { BracketOperations } from './brackets.js';
import { BracketEntryOperations } from './bracket-entries.js';
import { AnnouncementOperations } from './announcements.js';
import { NotificationOperations } from './notifications.js';
import { AuditLogOperations } from './audit-logs.js';
import { ThemeOperations } from './themes.js';

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
	public events: EventOperations;
	public facilities: FacilityOperations;
	public facilityAreas: FacilityAreaOperations;
	public sportOfficials: SportOfficialOperations;
	public divisionStandings: DivisionStandingOperations;
	public brackets: BracketOperations;
	public bracketEntries: BracketEntryOperations;
	public announcements: AnnouncementOperations;
	public notifications: NotificationOperations;
	public auditLogs: AuditLogOperations;
	public themes: ThemeOperations;

	constructor(platformOrDb: { env: { DB: D1Database } } | D1Database) {
		let db: D1Database;
		
		// Handle null/undefined platform in case of error
		if (!platformOrDb) {
			throw new Error('DatabaseOperations requires a Platform object or D1Database binding. Ensure your Cloudflare Pages project has the D1 database binding configured.');
		}

		// Handle both platform object and direct DB binding
		if ('env' in platformOrDb && platformOrDb.env && platformOrDb.env.DB) {
			db = platformOrDb.env.DB;
		} else if (platformOrDb && typeof (platformOrDb as any).prepare === 'function') {
			db = platformOrDb as D1Database;
		} else {
			throw new Error('DatabaseOperations requires a D1Database binding or Platform object. platform.env.DB was undefined.');
		}

		const drizzleDb = createDrizzleClient(db);

		this.clients = new ClientOperations(drizzleDb);
		this.users = new UserOperations(drizzleDb);
		this.sports = new SportOperations(drizzleDb);
		this.leagues = new LeagueOperations(drizzleDb);
		this.divisions = new DivisionOperations(drizzleDb);
		this.teams = new TeamOperations(drizzleDb);
		this.rosters = new RosterOperations(drizzleDb);
		this.events = new EventOperations(drizzleDb);
		this.facilities = new FacilityOperations(drizzleDb);
		this.facilityAreas = new FacilityAreaOperations(drizzleDb);
		this.sportOfficials = new SportOfficialOperations(drizzleDb);
		this.divisionStandings = new DivisionStandingOperations(drizzleDb);
		this.brackets = new BracketOperations(drizzleDb);
		this.bracketEntries = new BracketEntryOperations(drizzleDb);
		this.announcements = new AnnouncementOperations(drizzleDb);
		this.notifications = new NotificationOperations(drizzleDb);
		this.auditLogs = new AuditLogOperations(drizzleDb);
		this.themes = new ThemeOperations(drizzleDb);
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
export { EventOperations } from './events.js';
export { FacilityOperations } from './facilities.js';
export { FacilityAreaOperations } from './facility-areas.js';
export { SportOfficialOperations } from './sport-officials.js';
export { DivisionStandingOperations } from './division-standings.js';
export { BracketOperations } from './brackets.js';
export { BracketEntryOperations } from './bracket-entries.js';
export { AnnouncementOperations } from './announcements.js';
export { NotificationOperations } from './notifications.js';
export { AuditLogOperations } from './audit-logs.js';
export { ThemeOperations } from './themes.js';
