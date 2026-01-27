// Teams schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { divisions } from './divisions';


export const teams = sqliteTable('teams', {
	id: text().primaryKey(),
	clientId: text('client_id')
		.notNull()
		.references(() => clients.id),
	divisionId: text('division_id')
		.notNull()
		.references(() => divisions.id),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	imageUrl: text('image_url'),
	teamStatus: text('team_status').notNull(),
	doesAcceptFreeAgents: integer('does_accept_free_agents').default(0).notNull(),
	isAutoAcceptMembers: integer('is_auto_accept_members').default(0).notNull(),
	currentRosterSize: integer('current_roster_size').default(0).notNull(),
	teamColor: text('team_color'),
	dateRegistered: text('date_registered'),
	isActive: integer('is_active').default(1).notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
