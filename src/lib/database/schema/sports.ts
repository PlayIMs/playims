// Sports schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sports = sqliteTable('sports', {
	id: text(),
	name: text(),
	slug: text(),
	isActive: integer('is_active'),
	imageUrl: text('image_url'),
	minPlayers: integer('min_players'),
	maxPlayers: integer('max_players'),
	rulebookUrl: text('rulebook_url'),
	sport: text(),
	type: text(),
	description: text(),
	clientId: text('client_id'),
	createdAt: text('created_at'),
	updatedAt: text('updated_at')
});

export type Sport = typeof sports.$inferSelect;
export type NewSport = typeof sports.$inferInsert;
