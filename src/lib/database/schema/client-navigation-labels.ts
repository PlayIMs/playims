import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';

export const clientNavigationLabels = sqliteTable(
	'client_navigation_labels',
	{
		id: text().primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => clients.id, { onDelete: 'cascade' }),
		tabKey: text('tab_key').notNull(),
		label: text().notNull(),
		sortOrder: integer('sort_order').notNull(),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => [
		uniqueIndex('client_navigation_labels_client_tab_unique').on(table.clientId, table.tabKey),
		index('client_navigation_labels_client_idx').on(table.clientId)
	]
);

export type ClientNavigationLabel = typeof clientNavigationLabels.$inferSelect;
export type NewClientNavigationLabel = typeof clientNavigationLabels.$inferInsert;
