import { clients } from './clients';
import { users } from './users';
import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const searchRecents = sqliteTable(
	'search_recents',
	{
		id: text().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		clientId: text('client_id')
			.notNull()
			.references(() => clients.id, { onDelete: 'cascade' }),
		resultKey: text('result_key').notNull(),
		category: text().notNull(),
		title: text().notNull(),
		subtitle: text(),
		href: text().notNull(),
		badge: text(),
		meta: text(),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		uniqueIndex('search_recents_user_client_result_key_unique').on(
			table.userId,
			table.clientId,
			table.resultKey
		),
		index('search_recents_user_client_updated_at_idx').on(
			table.userId,
			table.clientId,
			table.updatedAt
		)
	]
);

export type SearchRecent = typeof searchRecents.$inferSelect;
export type NewSearchRecent = typeof searchRecents.$inferInsert;
