import { clients } from './clients';
import { users } from './users';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Session rows back cookie-based auth.
 * tokenHash stores HMAC(token) so raw tokens are never stored in DB.
 */
export const sessions = sqliteTable(
	'sessions',
	{
		id: text().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		clientId: text('client_id')
			.notNull()
			.references(() => clients.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull(),
		authProvider: text('auth_provider').notNull().default('password'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		expiresAt: text('expires_at').notNull(),
		lastSeenAt: text('last_seen_at').notNull(),
		revokedAt: text('revoked_at'),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		sessionVersion: integer('session_version').default(1).notNull()
	},
	(table) => [
		uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
		index('sessions_user_id_idx').on(table.userId),
		index('sessions_client_id_idx').on(table.clientId),
		index('sessions_expires_at_idx').on(table.expiresAt)
	]
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
