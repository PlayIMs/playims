import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Global registration invite keys.
 * `uses` tracks remaining uses to support one-time and limited-use invites.
 */
export const signupInviteKeys = sqliteTable(
	'signup_invite_keys',
	{
		id: text().primaryKey(),
		keyHash: text('key_hash').notNull(),
		uses: integer().notNull().default(1),
		expiresAt: text('expires_at'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		lastUsedAt: text('last_used_at'),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => [
		uniqueIndex('signup_invite_keys_key_hash_unique').on(table.keyHash),
		index('signup_invite_keys_expires_at_idx').on(table.expiresAt),
		index('signup_invite_keys_updated_at_idx').on(table.updatedAt)
	]
);

export type SignupInviteKey = typeof signupInviteKeys.$inferSelect;
export type NewSignupInviteKey = typeof signupInviteKeys.$inferInsert;
