CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`title` text,
	`description` text,
	`date` text,
	`location` text,
	`type` text,
	`is_active` integer DEFAULT 1,
	`created_at` text,
	`updated_at` text
);
