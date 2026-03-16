ALTER TABLE `user_clients` ADD `last_used_at` text;--> statement-breakpoint
CREATE INDEX `user_clients_user_last_used_idx` ON `user_clients` (`user_id`,`last_used_at`);