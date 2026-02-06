-- Keep Wrangler migration tracking in sync for legacy databases.
CREATE TABLE IF NOT EXISTS d1_migrations (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT UNIQUE,
	applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Copy over old Drizzle migration records when present.
INSERT OR IGNORE INTO d1_migrations (name)
SELECT hash
FROM __drizzle_migrations
WHERE hash LIKE '%.sql';

-- Fallback: if core baseline tables already exist, mark migration 0000 as applied.
INSERT OR IGNORE INTO d1_migrations (name)
SELECT '0000_flawless_hobgoblin.sql'
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'clients')
	AND EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users');

-- Backfill baseline tables for older prod DBs that were created before full migration history.
-- These are created only when missing and are shaped to satisfy later migration expectations.
CREATE TABLE IF NOT EXISTS sports (
	id TEXT PRIMARY KEY,
	name TEXT,
	slug TEXT,
	is_active INTEGER,
	image_url TEXT,
	min_players INTEGER,
	max_players INTEGER,
	rulebook_url TEXT,
	sport TEXT,
	type TEXT,
	description TEXT,
	client_id TEXT,
	created_at TEXT,
	updated_at TEXT,
	created_user TEXT,
	updated_user TEXT
);

CREATE TABLE IF NOT EXISTS leagues (
	id TEXT PRIMARY KEY,
	client_id TEXT,
	sport_id TEXT,
	name TEXT,
	slug TEXT,
	description TEXT,
	year INTEGER,
	season TEXT,
	gender TEXT,
	skill_level TEXT,
	reg_start_date TEXT,
	reg_end_date TEXT,
	season_start_date TEXT,
	season_end_date TEXT,
	has_postseason INTEGER,
	postseason_start_date TEXT,
	postseason_end_date TEXT,
	has_preseason INTEGER,
	preseason_start_date TEXT,
	preseason_end_date TEXT,
	is_active INTEGER,
	is_locked INTEGER,
	image_url TEXT,
	created_at TEXT,
	updated_at TEXT,
	created_user TEXT,
	updated_user TEXT
);

CREATE TABLE IF NOT EXISTS divisions (
	id TEXT PRIMARY KEY,
	league_id TEXT,
	name TEXT,
	slug TEXT,
	description TEXT,
	day_of_week TEXT,
	game_time TEXT,
	max_teams INTEGER,
	location TEXT,
	is_active INTEGER,
	is_locked INTEGER,
	teams_count INTEGER,
	start_date TEXT,
	created_at TEXT,
	updated_at TEXT
);

CREATE TABLE IF NOT EXISTS teams (
	id TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	division_id TEXT NOT NULL,
	name TEXT NOT NULL,
	slug TEXT NOT NULL,
	description TEXT,
	image_url TEXT,
	team_status TEXT NOT NULL,
	does_accept_free_agents INTEGER DEFAULT 0 NOT NULL,
	is_auto_accept_members INTEGER DEFAULT 0 NOT NULL,
	current_roster_size INTEGER DEFAULT 0 NOT NULL,
	team_color TEXT,
	date_registered TEXT,
	is_active INTEGER DEFAULT 1 NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	created_user TEXT,
	updated_user TEXT
);

CREATE TABLE IF NOT EXISTS rosters (
	id TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	team_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	is_captain INTEGER DEFAULT 0 NOT NULL,
	is_co_captain INTEGER DEFAULT 0 NOT NULL,
	roster_status TEXT NOT NULL,
	date_joined TEXT,
	date_left TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	created_user TEXT,
	updated_user TEXT
);
