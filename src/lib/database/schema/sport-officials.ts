// Sport officials schema
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sportOfficials = sqliteTable('sport_officials', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	eventId: text('event_id'),
	userId: text('user_id'),
	role: text(),
	status: text(),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type SportOfficial = typeof sportOfficials.$inferSelect;
export type NewSportOfficial = typeof sportOfficials.$inferInsert;
