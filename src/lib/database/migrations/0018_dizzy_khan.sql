ALTER TABLE `sessions` ADD `view_as_player` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `client_id`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;