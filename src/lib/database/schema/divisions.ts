// Divisions schema
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const divisions = sqliteTable(
	'divisions',
	{
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
		updatedAt: text('updated_at'),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => ({
		leagueSlugUnique: uniqueIndex('divisions_league_slug_unique')
			.on(table.leagueId, table.slug)
			.where(sql`${table.leagueId} is not null and ${table.slug} is not null and trim(${table.slug}) <> ''`)
	})
);

export type Division = typeof divisions.$inferSelect;
export type NewDivision = typeof divisions.$inferInsert;
