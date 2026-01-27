// Clients schema
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable('clients', {
	id: text().primaryKey(),
	name: text(),
	slug: text(),
	createdAt: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user'),
	status: text().default('sql`(active)`'),
	metadata: text()
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
