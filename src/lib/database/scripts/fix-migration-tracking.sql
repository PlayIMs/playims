-- Script to fix migration tracking table when migrations were applied manually
-- or the tracking table is out of sync.
--
-- This script checks if tables from migrations exist and marks those migrations
-- as applied in the __drizzle_migrations table.
--
-- Usage (production):
--   wrangler d1 execute playims-central-db-prod --remote --env production --file=src/lib/database/scripts/fix-migration-tracking.sql
--
-- Or inline:
--   wrangler d1 execute playims-central-db-prod --remote --env production --command "$(cat src/lib/database/scripts/fix-migration-tracking.sql)"

-- Create migration tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS __drizzle_migrations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	hash TEXT NOT NULL,
	created_at INTEGER
);

-- Check and mark 0000_flawless_hobgoblin.sql as applied if tables exist
-- This migration creates: clients, users, sports, leagues, divisions, teams, rosters
INSERT INTO __drizzle_migrations (hash, created_at)
SELECT '0000_flawless_hobgoblin.sql', strftime('%s', 'now') * 1000
WHERE NOT EXISTS (
	SELECT 1 FROM __drizzle_migrations WHERE hash = '0000_flawless_hobgoblin.sql'
)
AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='clients')
AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='users')
AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='sports')
AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='leagues')
AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='divisions')
AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='teams')
AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='rosters');

-- Check and mark 0001_sad_praxagora.sql as applied if tables exist
-- This migration creates: events
INSERT INTO __drizzle_migrations (hash, created_at)
SELECT '0001_sad_praxagora.sql', strftime('%s', 'now') * 1000
WHERE NOT EXISTS (
	SELECT 1 FROM __drizzle_migrations WHERE hash = '0001_sad_praxagora.sql'
)
AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='events');

-- Show current migration status
SELECT hash, datetime(created_at/1000, 'unixepoch') as applied_at 
FROM __drizzle_migrations 
ORDER BY created_at;