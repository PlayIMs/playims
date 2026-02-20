// Clients schema
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable(
	'clients',
	{
		id: text().primaryKey(),
		name: text(),
		slug: text(),
		createdAt: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
		updatedAt: text('updated_at'),
		createdUser: text('created_user'),
		updatedUser: text('updated_user'),
		status: text().default('sql`(active)`'),
		selfJoinEnabled: integer('self_join_enabled').notNull().default(0),
		metadata: text()
	},
	(table) => ({
		slugNormalizedUnique: uniqueIndex('clients_slug_normalized_unique')
			.on(sql`lower(trim(${table.slug}))`)
			.where(sql`${table.slug} is not null and trim(${table.slug}) <> ''`)
	})
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
