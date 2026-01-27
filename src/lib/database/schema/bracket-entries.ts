// Bracket entries schema
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const bracketEntries = sqliteTable('bracket_entries', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	bracketId: text('bracket_id'),
	seed: integer(),
	teamId: text('team_id'),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type BracketEntry = typeof bracketEntries.$inferSelect;
export type NewBracketEntry = typeof bracketEntries.$inferInsert;
