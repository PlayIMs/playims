// Themes schema
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const themes = sqliteTable('themes', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	name: text(),
	slug: text(),
	primary: text(),
	secondary: text(),
	neutral: text(),
	accent: text(),
	createdAt: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
