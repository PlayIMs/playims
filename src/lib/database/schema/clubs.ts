import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const clubs = sqliteTable(
	'clubs',
	{
		id: text().primaryKey(),
		clientId: text('client_id').notNull(),
		clubSeasonId: text('club_season_id').notNull(),
		name: text().notNull(),
		slug: text().notNull(),
		sport: text(),
		description: text(),
		imageUrl: text('image_url'),
		isActive: integer('is_active').default(1).notNull(),
		seriesId: text('series_id'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => ({
		clientSeasonSlugUnique: uniqueIndex('clubs_client_season_slug_unique').on(
			table.clientId,
			table.clubSeasonId,
			table.slug
		),
		clientSeasonSeriesUnique: uniqueIndex('clubs_client_season_series_unique')
			.on(table.clientId, table.clubSeasonId, table.seriesId)
			.where(sql`${table.seriesId} is not null and trim(${table.seriesId}) <> ''`)
	})
);

export type Club = typeof clubs.$inferSelect;
export type NewClub = typeof clubs.$inferInsert;
