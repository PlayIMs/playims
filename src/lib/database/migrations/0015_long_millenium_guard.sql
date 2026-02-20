CREATE TABLE `client_database_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`route_mode` text DEFAULT 'central_shared' NOT NULL,
	`binding_name` text,
	`database_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_database_routes_client_unique` ON `client_database_routes` (`client_id`);--> statement-breakpoint
CREATE INDEX `client_database_routes_status_idx` ON `client_database_routes` (`status`);--> statement-breakpoint
ALTER TABLE `clients` ADD `self_join_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `offerings` ADD `season_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `offerings_client_season_slug_unique` ON `offerings` (`client_id`,`season_id`,`slug`);