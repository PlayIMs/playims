import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const clubLeagues = sqliteTable(
	'club_leagues',
	{
		id: text().primaryKey(),
		clientId: text('client_id').notNull(),
		clubSeasonId: text('club_season_id').notNull(),
		clubId: text('club_id').notNull(),
		name: text().notNull(),
		slug: text().notNull(),
		stackOrder: integer('stack_order').default(1).notNull(),
		description: text(),
		gender: text(),
		regStartDate: text('reg_start_date'),
		regEndDate: text('reg_end_date'),
		seasonStartDate: text('season_start_date'),
		seasonEndDate: text('season_end_date'),
		isActive: integer('is_active').default(1).notNull(),
		isLocked: integer('is_locked').default(0).notNull(),
		imageUrl: text('image_url'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => ({
		clubSlugUnique: uniqueIndex('club_leagues_club_slug_unique')
			.on(table.clubId, table.slug)
			.where(sql`${table.clubId} is not null and trim(${table.slug}) <> ''`)
	})
);

export type ClubLeague = typeof clubLeagues.$inferSelect;
export type NewClubLeague = typeof clubLeagues.$inferInsert;
