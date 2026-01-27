// Brackets schema
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const brackets = sqliteTable('brackets', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	leagueId: text('league_id'),
	divisionId: text('division_id'),
	name: text(),
	type: text(),
	startsAt: text('starts_at'),
	endsAt: text('ends_at'),
	status: text(),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type Bracket = typeof brackets.$inferSelect;
export type NewBracket = typeof brackets.$inferInsert;
