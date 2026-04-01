import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const communicationMessageRecipients = sqliteTable(
	'communication_message_recipients',
	{
		id: text().primaryKey(),
		messageId: text('message_id').notNull(),
		userId: text('user_id'),
		email: text().notNull(),
		fullName: text('full_name').notNull(),
		resolutionMetadata: text('resolution_metadata'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		index('communication_message_recipients_message_idx').on(table.messageId),
		index('communication_message_recipients_message_email_idx').on(table.messageId, table.email)
	]
);

export type CommunicationMessageRecipient = typeof communicationMessageRecipients.$inferSelect;
export type NewCommunicationMessageRecipient = typeof communicationMessageRecipients.$inferInsert;
