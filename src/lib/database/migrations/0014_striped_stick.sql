CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`name` text,
	`slug` text,
	`start_date` text,
	`end_date` text,
	`is_current` integer DEFAULT 0,
	`is_active` integer DEFAULT 1,
	`created_at` text,
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
ALTER TABLE `leagues` ADD `season_id` text;