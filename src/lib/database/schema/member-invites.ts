import { clients } from './clients';
import { users } from './users';
import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const memberInvites = sqliteTable(
	'member_invites',
	{
		id: text().primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => clients.id, { onDelete: 'cascade' }),
		email: text().notNull(),
		firstName: text('first_name'),
		lastName: text('last_name'),
		studentId: text('student_id'),
		sex: text(),
		role: text().notNull().default('participant'),
		mode: text().notNull().default('invite'),
		tokenHash: text('token_hash').notNull(),
		status: text().notNull().default('pending'),
		expiresAt: text('expires_at').notNull(),
		acceptedAt: text('accepted_at'),
		acceptedUserId: text('accepted_user_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => [
		uniqueIndex('member_invites_token_hash_unique').on(table.tokenHash),
		uniqueIndex('member_invites_pending_email_unique')
			.on(table.clientId, sql`lower(trim(${table.email}))`)
			.where(sql`${table.status} = 'pending' and trim(${table.email}) <> ''`),
		index('member_invites_client_status_created_idx').on(
			table.clientId,
			table.status,
			table.createdAt
		),
		index('member_invites_expires_at_idx').on(table.expiresAt)
	]
);

export type MemberInvite = typeof memberInvites.$inferSelect;
export type NewMemberInvite = typeof memberInvites.$inferInsert;
