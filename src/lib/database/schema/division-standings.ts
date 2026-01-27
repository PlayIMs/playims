// Division standings schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const divisionStandings = sqliteTable('division_standings', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	leagueId: text('league_id'),
	divisionId: text('division_id'),
	teamId: text('team_id'),
	wins: integer(),
	losses: integer(),
	ties: integer(),
	pointsFor: integer('points_for'),
	pointsAgainst: integer('points_against'),
	points: integer(),
	winPct: text('win_pct'),
	streak: text(),
	lastUpdatedAt: text('last_updated_at'),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type DivisionStanding = typeof divisionStandings.$inferSelect;
export type NewDivisionStanding = typeof divisionStandings.$inferInsert;
