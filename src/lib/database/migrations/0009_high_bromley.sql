CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`name` text,
	`slug` text,
	`primary` text,
	`secondary` text,
	`neutral` text,
	`accent` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`updated_at` text,
	`created_user` text,
	`updated_user` text
);
