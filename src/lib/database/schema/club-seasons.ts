import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const clubSeasons = sqliteTable(
	'club_seasons',
	{
		id: text().primaryKey(),
		clientId: text('client_id').notNull(),
		name: text().notNull(),
		slug: text().notNull(),
		startDate: text('start_date').notNull(),
		endDate: text('end_date'),
		isCurrent: integer('is_current').default(0).notNull(),
		isActive: integer('is_active').default(1).notNull(),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => ({
		clientSlugUnique: uniqueIndex('club_seasons_client_slug_unique').on(table.clientId, table.slug)
	})
);

export type ClubSeason = typeof clubSeasons.$inferSelect;
export type NewClubSeason = typeof clubSeasons.$inferInsert;
