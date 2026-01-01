// Divisions schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const divisions = sqliteTable('divisions', {
	id: text().primaryKey(),
	leagueId: text('league_id'),
	name: text(),
	slug: text(),
	description: text(),
	dayOfWeek: text('day_of_week'),
	gameTime: text('game_time'),
	maxTeams: integer('max_teams'),
	location: text(),
	isActive: integer('is_active'),
	isLocked: integer('is_locked'),
	teamsCount: integer('teams_count'),
	startDate: text('start_date'),
	createdAt: text('created_at'),
	updatedAt: text('updated_at')
});

export type Division = typeof divisions.$inferSelect;
export type NewDivision = typeof divisions.$inferInsert;
