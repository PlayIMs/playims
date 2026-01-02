// Events schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable('events', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	title: text(),
	description: text(),
	date: text(), // ISO timestamp
	location: text(),
	type: text(), // 'game', 'meeting', 'social', etc.
	isActive: integer('is_active').default(1),
	createdAt: text('created_at'),
	updatedAt: text('updated_at')
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
