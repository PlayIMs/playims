// Events schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable('events', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	sportId: text('sport_id'),
	leagueId: text('league_id'),
	divisionId: text('division_id'),
	facilityId: text('facility_id'),
	facilityAreaId: text('facility_area_id'),
	homeTeamId: text('home_team_id'),
	awayTeamId: text('away_team_id'),
	scheduledStartAt: text('scheduled_start_at'),
	scheduledEndAt: text('scheduled_end_at'),
	actualStartAt: text('actual_start_at'),
	actualEndAt: text('actual_end_at'),
	status: text(),
	isPostseason: integer('is_postseason'),
	roundLabel: text('round_label'),
	weekNumber: integer('week_number'),
	homeScore: integer('home_score'),
	awayScore: integer('away_score'),
	winnerTeamId: text('winner_team_id'),
	forfeitType: text('forfeit_type'),
	notes: text(),
	type: text(), // 'game', 'meeting', 'social', etc.
	isActive: integer('is_active').default(1),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
