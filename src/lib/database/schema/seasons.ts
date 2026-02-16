// Seasons schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const seasons = sqliteTable('seasons', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	name: text(),
	slug: text(),
	startDate: text('start_date'),
	endDate: text('end_date'),
	isCurrent: integer('is_current').default(0),
	isActive: integer('is_active').default(1),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;
