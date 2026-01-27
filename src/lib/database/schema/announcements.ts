// Announcements schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const announcements = sqliteTable('announcements', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	leagueId: text('league_id'),
	divisionId: text('division_id'),
	title: text(),
	body: text(),
	publishedAt: text('published_at'),
	isPinned: integer('is_pinned'),
	isActive: integer('is_active').default(1),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
