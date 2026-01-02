CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`slug` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`updated_at` text,
	`status` text DEFAULT 'sql`(active)`',
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`email` text,
	`email_verified_at` text,
	`password_hash` text,
	`sso_user_id` text,
	`first_name` text,
	`last_name` text,
	`avatar_url` text,
	`created_at` text,
	`updated_at` text,
	`first_login_at` text,
	`last_login_at` text,
	`status` text,
	`role` text DEFAULT 'sql`(player)`',
	`timezone` text,
	`last_active_at` text,
	`session_count` integer,
	`preferences` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `sports` (
	`id` text,
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
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `leagues` (
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
	`image_url` integer,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `divisions` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text,
	`name` text,
	`slug` text,
	`description` text,
	`day_of_week` text,
	`game_time` text,
	`max_teams` integer,
	`location` text,
	`is_active` integer,
	`is_locked` integer,
	`teams_count` integer,
	`start_date` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY NOT NULL,
	`client_id` integer NOT NULL,
	`division_id` integer NOT NULL,
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
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rosters` (
	`id` integer PRIMARY KEY NOT NULL,
	`client_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`is_captain` integer DEFAULT 0 NOT NULL,
	`is_co_captain` integer DEFAULT 0 NOT NULL,
	`roster_status` text NOT NULL,
	`date_joined` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
