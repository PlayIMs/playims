import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';

export const clientDatabaseRoutes = sqliteTable(
	'client_database_routes',
	{
		id: text().primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => clients.id, { onDelete: 'cascade' }),
		routeMode: text('route_mode').notNull().default('central_shared'),
		bindingName: text('binding_name'),
		databaseId: text('database_id'),
		status: text().notNull().default('active'),
		metadata: text(),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => [
		uniqueIndex('client_database_routes_client_unique').on(table.clientId),
		index('client_database_routes_status_idx').on(table.status)
	]
);

export type ClientDatabaseRoute = typeof clientDatabaseRoutes.$inferSelect;
export type NewClientDatabaseRoute = typeof clientDatabaseRoutes.$inferInsert;
