import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Shared, cross-instance rate-limit buckets keyed by route + actor identifiers.
 */
export const authRateLimits = sqliteTable(
	'auth_rate_limits',
	{
		id: text().primaryKey(),
		key: text().notNull(),
		windowMs: integer('window_ms').notNull(),
		windowStartMs: integer('window_start_ms').notNull(),
		count: integer().notNull().default(0),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		uniqueIndex('auth_rate_limits_key_window_unique').on(table.key, table.windowMs),
		index('auth_rate_limits_updated_at_idx').on(table.updatedAt),
		index('auth_rate_limits_window_start_idx').on(table.windowStartMs)
	]
);

export type AuthRateLimit = typeof authRateLimits.$inferSelect;
export type NewAuthRateLimit = typeof authRateLimits.$inferInsert;
