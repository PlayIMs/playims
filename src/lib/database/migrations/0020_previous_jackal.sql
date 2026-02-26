CREATE TABLE `client_navigation_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`tab_key` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_navigation_labels_client_tab_unique` ON `client_navigation_labels` (`client_id`,`tab_key`);--> statement-breakpoint
CREATE INDEX `client_navigation_labels_client_idx` ON `client_navigation_labels` (`client_id`);