import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const communicationMessageRecipientGroups = sqliteTable(
	'communication_message_batches',
	{
		id: text().primaryKey(),
		messageId: text('message_id').notNull(),
		mode: text().notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		filtersJson: text('filters_json').notNull(),
		summaryText: text('summary_text').notNull().default(''),
		resolvedRecipientCount: integer('resolved_recipient_count').notNull().default(0),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		index('communication_message_batches_message_order_idx').on(table.messageId, table.sortOrder)
	]
);

export type CommunicationMessageRecipientGroup = typeof communicationMessageRecipientGroups.$inferSelect;
export type NewCommunicationMessageRecipientGroup = typeof communicationMessageRecipientGroups.$inferInsert;
