// Facilities schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const facilities = sqliteTable('facilities', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	name: text(),
	slug: text(),
	addressLine1: text('address_line1'),
	addressLine2: text('address_line2'),
	city: text(),
	state: text(),
	postalCode: text('postal_code'),
	country: text(),
	timezone: text(),
	capacity: integer('capacity'),
	description: text(),
	metadata: text(),
	isActive: integer('is_active').default(1),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type Facility = typeof facilities.$inferSelect;
export type NewFacility = typeof facilities.$inferInsert;
