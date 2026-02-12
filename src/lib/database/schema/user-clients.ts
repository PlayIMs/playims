import { clients } from './clients';
import { users } from './users';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Membership table linking a global user identity to one or more clients.
 * Session client context resolves authorization against these rows.
 */
export const userClients = sqliteTable(
	'user_clients',
	{
		id: text().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		clientId: text('client_id')
			.notNull()
			.references(() => clients.id, { onDelete: 'cascade' }),
		role: text().notNull().default('player'),
		status: text().notNull().default('active'),
		isDefault: integer('is_default').notNull().default(0),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => [
		uniqueIndex('user_clients_user_client_unique').on(table.userId, table.clientId),
		index('user_clients_user_id_idx').on(table.userId),
		index('user_clients_client_id_idx').on(table.clientId),
		index('user_clients_default_idx').on(table.userId, table.isDefault)
	]
);

export type UserClient = typeof userClients.$inferSelect;
export type NewUserClient = typeof userClients.$inferInsert;
