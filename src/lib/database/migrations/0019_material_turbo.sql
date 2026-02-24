PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`role` text DEFAULT 'participant' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_clients`("id", "user_id", "client_id", "role", "status", "is_default", "created_at", "updated_at", "created_user", "updated_user") SELECT "id", "user_id", "client_id", "role", "status", "is_default", "created_at", "updated_at", "created_user", "updated_user" FROM `user_clients`;--> statement-breakpoint
DROP TABLE `user_clients`;--> statement-breakpoint
ALTER TABLE `__new_user_clients` RENAME TO `user_clients`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_clients_user_client_unique` ON `user_clients` (`user_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `user_clients_user_id_idx` ON `user_clients` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_clients_client_id_idx` ON `user_clients` (`client_id`);--> statement-breakpoint
CREATE INDEX `user_clients_default_idx` ON `user_clients` (`user_id`,`is_default`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `view_as_role` text;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `view_as_player`;