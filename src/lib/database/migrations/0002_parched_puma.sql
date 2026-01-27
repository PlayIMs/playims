CREATE TABLE `facilities` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`name` text,
	`slug` text,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`country` text,
	`timezone` text,
	`notes` text,
	`metadata` text,
	`is_active` integer DEFAULT 1,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `facility_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`facility_id` text,
	`name` text,
	`code` text,
	`surface_type` text,
	`is_indoor` integer,
	`is_active` integer DEFAULT 1,
	`metadata` text,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `sport_officials` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`event_id` text,
	`user_id` text,
	`role` text,
	`status` text,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `division_standings` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`league_id` text,
	`division_id` text,
	`team_id` text,
	`wins` integer,
	`losses` integer,
	`ties` integer,
	`points_for` integer,
	`points_against` integer,
	`points` integer,
	`win_pct` text,
	`streak` text,
	`last_updated_at` text,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `brackets` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`league_id` text,
	`division_id` text,
	`name` text,
	`type` text,
	`starts_at` text,
	`ends_at` text,
	`status` text,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `bracket_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`bracket_id` text,
	`seed` integer,
	`team_id` text,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`league_id` text,
	`division_id` text,
	`title` text,
	`body` text,
	`published_at` text,
	`is_pinned` integer,
	`is_active` integer DEFAULT 1,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`user_id` text,
	`type` text,
	`title` text,
	`body` text,
	`entity_type` text,
	`entity_id` text,
	`read_at` text,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`actor_user_id` text,
	`action` text,
	`entity_type` text,
	`entity_id` text,
	`details` text,
	`ip_address` text,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sports` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`slug` text,
	`is_active` integer,
	`image_url` text,
	`min_players` integer,
	`max_players` integer,
	`rulebook_url` text,
	`sport` text,
	`type` text,
	`description` text,
	`client_id` text,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
INSERT INTO `__new_sports`("id", "name", "slug", "is_active", "image_url", "min_players", "max_players", "rulebook_url", "sport", "type", "description", "client_id", "created_at", "updated_at", "created_user", "updated_user") SELECT "id", "name", "slug", "is_active", "image_url", "min_players", "max_players", "rulebook_url", "sport", "type", "description", "client_id", "created_at", "updated_at", "created_user", "updated_user" FROM `sports`;--> statement-breakpoint
DROP TABLE `sports`;--> statement-breakpoint
ALTER TABLE `__new_sports` RENAME TO `sports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`sport_id` text,
	`name` text,
	`slug` text,
	`description` text,
	`year` integer,
	`season` text,
	`gender` text,
	`skill_level` text,
	`reg_start_date` text,
	`reg_end_date` text,
	`season_start_date` text,
	`season_end_date` text,
	`has_postseason` integer,
	`postseason_start_date` text,
	`postseason_end_date` text,
	`has_preseason` integer,
	`preseason_start_date` text,
	`preseason_end_date` text,
	`is_active` integer,
	`is_locked` integer,
	`image_url` text,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
INSERT INTO `__new_leagues`("id", "client_id", "sport_id", "name", "slug", "description", "year", "season", "gender", "skill_level", "reg_start_date", "reg_end_date", "season_start_date", "season_end_date", "has_postseason", "postseason_start_date", "postseason_end_date", "has_preseason", "preseason_start_date", "preseason_end_date", "is_active", "is_locked", "image_url", "created_at", "updated_at", "created_user", "updated_user") SELECT "id", "client_id", "sport_id", "name", "slug", "description", "year", "season", "gender", "skill_level", "reg_start_date", "reg_end_date", "season_start_date", "season_end_date", "has_postseason", "postseason_start_date", "postseason_end_date", "has_preseason", "preseason_start_date", "preseason_end_date", "is_active", "is_locked", "image_url", "created_at", "updated_at", "created_user", "updated_user" FROM `leagues`;--> statement-breakpoint
DROP TABLE `leagues`;--> statement-breakpoint
ALTER TABLE `__new_leagues` RENAME TO `leagues`;--> statement-breakpoint
CREATE TABLE `__new_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`division_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`image_url` text,
	`team_status` text NOT NULL,
	`does_accept_free_agents` integer DEFAULT 0 NOT NULL,
	`is_auto_accept_members` integer DEFAULT 0 NOT NULL,
	`current_roster_size` integer DEFAULT 0 NOT NULL,
	`team_color` text,
	`date_registered` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_teams`("id", "client_id", "division_id", "name", "slug", "description", "image_url", "team_status", "does_accept_free_agents", "is_auto_accept_members", "current_roster_size", "team_color", "date_registered", "is_active", "created_at", "updated_at", "created_user", "updated_user") SELECT "id", "client_id", "division_id", "name", "slug", "description", "image_url", "team_status", "does_accept_free_agents", "is_auto_accept_members", "current_roster_size", "team_color", "date_registered", "is_active", "created_at", "updated_at", "created_user", "updated_user" FROM `teams`;--> statement-breakpoint
DROP TABLE `teams`;--> statement-breakpoint
ALTER TABLE `__new_teams` RENAME TO `teams`;--> statement-breakpoint
CREATE TABLE `__new_rosters` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`is_captain` integer DEFAULT 0 NOT NULL,
	`is_co_captain` integer DEFAULT 0 NOT NULL,
	`roster_status` text NOT NULL,
	`date_joined` text,
	`date_left` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_rosters`("id", "client_id", "team_id", "user_id", "is_captain", "is_co_captain", "roster_status", "date_joined", "date_left", "created_at", "updated_at", "created_user", "updated_user") SELECT "id", "client_id", "team_id", "user_id", "is_captain", "is_co_captain", "roster_status", "date_joined", "date_left", "created_at", "updated_at", "created_user", "updated_user" FROM `rosters`;--> statement-breakpoint
DROP TABLE `rosters`;--> statement-breakpoint
ALTER TABLE `__new_rosters` RENAME TO `rosters`;--> statement-breakpoint
ALTER TABLE `clients` ADD `created_user` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `updated_user` text;--> statement-breakpoint
ALTER TABLE `users` ADD `created_user` text;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_user` text;--> statement-breakpoint
ALTER TABLE `divisions` ADD `created_user` text;--> statement-breakpoint
ALTER TABLE `divisions` ADD `updated_user` text;--> statement-breakpoint
ALTER TABLE `events` ADD `sport_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `league_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `division_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `facility_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `facility_area_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `home_team_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `away_team_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `scheduled_start_at` text;--> statement-breakpoint
ALTER TABLE `events` ADD `scheduled_end_at` text;--> statement-breakpoint
ALTER TABLE `events` ADD `actual_start_at` text;--> statement-breakpoint
ALTER TABLE `events` ADD `actual_end_at` text;--> statement-breakpoint
ALTER TABLE `events` ADD `status` text;--> statement-breakpoint
ALTER TABLE `events` ADD `is_postseason` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `round_label` text;--> statement-breakpoint
ALTER TABLE `events` ADD `week_number` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `home_score` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `away_score` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `winner_team_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `forfeit_type` text;--> statement-breakpoint
ALTER TABLE `events` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `events` ADD `created_user` text;--> statement-breakpoint
ALTER TABLE `events` ADD `updated_user` text;--> statement-breakpoint
ALTER TABLE `events` DROP COLUMN `title`;--> statement-breakpoint
ALTER TABLE `events` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `events` DROP COLUMN `date`;--> statement-breakpoint
ALTER TABLE `events` DROP COLUMN `location`;