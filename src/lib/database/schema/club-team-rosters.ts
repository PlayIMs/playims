import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const clubTeamRosters = sqliteTable('club_team_rosters', {
	id: text().primaryKey(),
	clientId: text('client_id').notNull(),
	clubSeasonId: text('club_season_id').notNull(),
	clubId: text('club_id').notNull(),
	clubTeamId: text('club_team_id').notNull(),
	userId: text('user_id').notNull(),
	rosterStatus: text('roster_status').notNull(),
	isActive: integer('is_active').default(1).notNull(),
	dateJoined: text('date_joined'),
	dateLeft: text('date_left'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type ClubTeamRoster = typeof clubTeamRosters.$inferSelect;
export type NewClubTeamRoster = typeof clubTeamRosters.$inferInsert;
