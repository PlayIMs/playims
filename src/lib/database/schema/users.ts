// Users schema
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
	'users',
	{
		id: text().primaryKey(),
		email: text(),
		emailVerifiedAt: text('email_verified_at'),
		passwordHash: text('password_hash'),
		ssoUserId: text('sso_user_id'),
		firstName: text('first_name'),
		lastName: text('last_name'),
		cellPhone: text('cell_phone'),
		avatarUrl: text('avatar_url'),
		createdAt: text('created_at'),
		updatedAt: text('updated_at'),
		createdUser: text('created_user'),
		updatedUser: text('updated_user'),
		firstLoginAt: text('first_login_at'),
		lastLoginAt: text('last_login_at'),
		status: text(),
		timezone: text(),
		lastActiveAt: text('last_active_at'),
		sessionCount: integer('session_count'),
		preferences: text(),
		notes: text()
	},
	(table) => [
		index('users_first_name_idx').on(table.firstName),
		index('users_last_name_idx').on(table.lastName)
	]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
