// Facility areas schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const facilityAreas = sqliteTable('facility_areas', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	facilityId: text('facility_id'),
	name: text(),
	slug: text(),
	description: text(),
	metadata: text(),
	isActive: integer('is_active').default(1),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type FacilityArea = typeof facilityAreas.$inferSelect;
export type NewFacilityArea = typeof facilityAreas.$inferInsert;
