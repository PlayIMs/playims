import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const clubTeams = sqliteTable('club_teams', {
	id: text().primaryKey(),
	clientId: text('client_id').notNull(),
	clubSeasonId: text('club_season_id').notNull(),
	clubId: text('club_id').notNull(),
	clubLeagueId: text('club_league_id').notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	imageUrl: text('image_url'),
	teamColor: text('team_color'),
	currentRosterSize: integer('current_roster_size').default(0).notNull(),
	dateRegistered: text('date_registered'),
	isActive: integer('is_active').default(1).notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type ClubTeam = typeof clubTeams.$inferSelect;
export type NewClubTeam = typeof clubTeams.$inferInsert;
