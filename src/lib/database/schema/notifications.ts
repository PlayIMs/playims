// Notifications schema
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const notifications = sqliteTable('notifications', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	userId: text('user_id'),
	type: text(),
	title: text(),
	body: text(),
	entityType: text('entity_type'),
	entityId: text('entity_id'),
	readAt: text('read_at'),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
