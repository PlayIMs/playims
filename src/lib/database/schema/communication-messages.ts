import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const communicationMessages = sqliteTable(
	'communication_messages',
	{
		id: text().primaryKey(),
		clientId: text('client_id').notNull(),
		channel: text().notNull().default('email'),
		status: text().notNull().default('draft'),
		subject: text().notNull().default(''),
		editorJson: text('editor_json'),
		bodyHtml: text('body_html').notNull().default(''),
		bodyText: text('body_text').notNull().default(''),
		recipientCount: integer('recipient_count').notNull().default(0),
		sentAt: text('sent_at'),
		failureMessage: text('failure_message'),
		providerMessageId: text('provider_message_id'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		createdUser: text('created_user'),
		updatedUser: text('updated_user')
	},
	(table) => [
		index('communication_messages_client_status_idx').on(table.clientId, table.status),
		index('communication_messages_client_updated_idx').on(table.clientId, table.updatedAt)
	]
);

export type CommunicationMessage = typeof communicationMessages.$inferSelect;
export type NewCommunicationMessage = typeof communicationMessages.$inferInsert;
