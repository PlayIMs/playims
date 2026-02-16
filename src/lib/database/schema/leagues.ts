// Leagues schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const leagues = sqliteTable('leagues', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	offeringId: text('offering_id'),
	seasonId: text('season_id'),
	name: text(),
	slug: text(),
	stackOrder: integer('stack_order').default(1),
	description: text(),
	year: integer(),
	season: text(),
	gender: text(),
	skillLevel: text('skill_level'),
	regStartDate: text('reg_start_date'),
	regEndDate: text('reg_end_date'),
	seasonStartDate: text('season_start_date'),
	seasonEndDate: text('season_end_date'),
	hasPostseason: integer('has_postseason'),
	postseasonStartDate: text('postseason_start_date'),
	postseasonEndDate: text('postseason_end_date'),
	hasPreseason: integer('has_preseason'),
	preseasonStartDate: text('preseason_start_date'),
	preseasonEndDate: text('preseason_end_date'),
	isActive: integer('is_active'),
	isLocked: integer('is_locked'),
	imageUrl: text('image_url'),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
