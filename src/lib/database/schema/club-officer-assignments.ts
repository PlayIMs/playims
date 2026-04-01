import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const clubOfficerAssignments = sqliteTable('club_officer_assignments', {
	id: text().primaryKey(),
	clientId: text('client_id').notNull(),
	clubSeasonId: text('club_season_id').notNull(),
	clubId: text('club_id').notNull(),
	clubLeagueId: text('club_league_id'),
	clubTeamId: text('club_team_id'),
	titleId: text('title_id').notNull(),
	userId: text('user_id').notNull(),
	isActive: integer('is_active').default(1).notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type ClubOfficerAssignment = typeof clubOfficerAssignments.$inferSelect;
export type NewClubOfficerAssignment = typeof clubOfficerAssignments.$inferInsert;
