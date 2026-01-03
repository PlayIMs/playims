/**
 * Script to fix migration tracking table when migrations were applied manually
 * or the tracking table is out of sync.
 *
 * This script checks if tables from migrations exist and marks those migrations
 * as applied in the __drizzle_migrations table.
 *
 * Usage (local):
 *   pnpm tsx src/lib/database/scripts/fix-migration-tracking.ts
 *
 * Usage (production via wrangler):
 *   wrangler d1 execute playims-central-db-prod --remote --env production --command "$(cat fix-migration-tracking.sql)"
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../schema/index.js';

// Migration files and their expected tables
const MIGRATION_TABLES: Record<string, string[]> = {
	'0000_flawless_hobgoblin.sql': [
		'clients',
		'users',
		'sports',
		'leagues',
		'divisions',
		'teams',
		'rosters'
	],
	'0001_sad_praxagora.sql': ['events']
};

/**
 * Check if a table exists in the database
 */
async function tableExists(db: D1Database, tableName: string): Promise<boolean> {
	try {
		const result = await db
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
			.bind(tableName)
			.first();
		return result !== null;
	} catch (error) {
		console.error(`Error checking table ${tableName}:`, error);
		return false;
	}
}

/**
 * Check if migration tracking table exists
 */
async function migrationTableExists(db: D1Database): Promise<boolean> {
	return tableExists(db, '__drizzle_migrations');
}

/**
 * Create migration tracking table if it doesn't exist
 */
async function createMigrationTable(db: D1Database): Promise<void> {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS __drizzle_migrations (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at integer
		)
	`);
}

/**
 * Check if a migration is already recorded
 */
async function migrationRecorded(db: D1Database, migrationName: string): Promise<boolean> {
	try {
		const result = await db
			.prepare(`SELECT hash FROM __drizzle_migrations WHERE hash = ?`)
			.bind(migrationName)
			.first();
		return result !== null;
	} catch (error) {
		console.error(`Error checking migration ${migrationName}:`, error);
		return false;
	}
}

/**
 * Mark a migration as applied
 */
async function markMigrationApplied(db: D1Database, migrationName: string): Promise<void> {
	const timestamp = Date.now();
	await db
		.prepare(`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`)
		.bind(migrationName, timestamp)
		.run();
	console.log(`✓ Marked ${migrationName} as applied`);
}

/**
 * Check if all tables for a migration exist
 */
async function migrationTablesExist(db: D1Database, tables: string[]): Promise<boolean> {
	for (const table of tables) {
		if (!(await tableExists(db, table))) {
			return false;
		}
	}
	return true;
}

/**
 * Main function to fix migration tracking
 */
export async function fixMigrationTracking(db: D1Database): Promise<void> {
	console.log('Checking migration tracking...\n');

	// Ensure migration table exists
	if (!(await migrationTableExists(db))) {
		console.log('Creating __drizzle_migrations table...');
		await createMigrationTable(db);
	}

	// Check each migration
	for (const [migrationName, expectedTables] of Object.entries(MIGRATION_TABLES)) {
		const isRecorded = await migrationRecorded(db, migrationName);
		const tablesExist = await migrationTablesExist(db, expectedTables);

		if (tablesExist && !isRecorded) {
			console.log(`⚠ Migration ${migrationName} tables exist but migration not recorded.`);
			await markMigrationApplied(db, migrationName);
		} else if (isRecorded) {
			console.log(`✓ Migration ${migrationName} already recorded`);
		} else if (!tablesExist) {
			console.log(`○ Migration ${migrationName} not applied (tables don't exist)`);
		}
	}

	console.log('\nMigration tracking check complete!');
}

// If run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
	console.error('This script requires a D1 database instance. Use wrangler d1 execute instead.');
	console.error('See the SQL version: src/lib/database/scripts/fix-migration-tracking.sql');
	process.exit(1);
}
