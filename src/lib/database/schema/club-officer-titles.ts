import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const clubOfficerTitles = sqliteTable('club_officer_titles', {
	id: text().primaryKey(),
	clientId: text('client_id').notNull(),
	clubId: text('club_id'),
	name: text().notNull(),
	slug: text().notNull(),
	scope: text().notNull(),
	isBuiltIn: integer('is_built_in').default(0).notNull(),
	isOrgManaged: integer('is_org_managed').default(0).notNull(),
	isActive: integer('is_active').default(1).notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull(),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type ClubOfficerTitle = typeof clubOfficerTitles.$inferSelect;
export type NewClubOfficerTitle = typeof clubOfficerTitles.$inferInsert;
