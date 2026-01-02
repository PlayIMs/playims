// Rosters schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { teams } from './teams';
import { users } from './users';


export const rosters = sqliteTable('rosters', {
	id: integer().primaryKey(),
	clientId: integer('client_id')
		.notNull()
		.references(() => clients.id),
	teamId: integer('team_id')
		.notNull()
		.references(() => teams.id),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id),
	isCaptain: integer('is_captain').default(0).notNull(),
	isCoCaptain: integer('is_co_captain').default(0).notNull(),
	rosterStatus: text('roster_status').notNull(),
	dateJoined: text('date_joined'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export type Roster = typeof rosters.$inferSelect;
export type NewRoster = typeof rosters.$inferInsert;
