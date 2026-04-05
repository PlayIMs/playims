import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const communicationMessageManualRecipients = sqliteTable(
	'communication_message_manual_recipients',
	{
		id: text().primaryKey(),
		messageId: text('message_id').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		userId: text('user_id'),
		email: text().notNull(),
		fullName: text('full_name').notNull(),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		index('communication_message_manual_recipients_message_order_idx').on(
			table.messageId,
			table.sortOrder
		),
		index('communication_message_manual_recipients_message_email_idx').on(
			table.messageId,
			table.email
		)
	]
);

export type CommunicationMessageManualRecipient =
	typeof communicationMessageManualRecipients.$inferSelect;
export type NewCommunicationMessageManualRecipient =
	typeof communicationMessageManualRecipients.$inferInsert;
