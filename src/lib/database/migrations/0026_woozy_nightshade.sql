CREATE TABLE `search_recents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`result_key` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`href` text NOT NULL,
	`badge` text,
	`meta` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_recents_user_client_result_key_unique` ON `search_recents` (`user_id`,`client_id`,`result_key`);--> statement-breakpoint
CREATE INDEX `search_recents_user_client_updated_at_idx` ON `search_recents` (`user_id`,`client_id`,`updated_at`);