CREATE TABLE `signup_invite_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`uses` integer DEFAULT 1 NOT NULL,
	`expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_used_at` text,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signup_invite_keys_key_hash_unique` ON `signup_invite_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `signup_invite_keys_expires_at_idx` ON `signup_invite_keys` (`expires_at`);--> statement-breakpoint
CREATE INDEX `signup_invite_keys_updated_at_idx` ON `signup_invite_keys` (`updated_at`);--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`window_ms` integer NOT NULL,
	`window_start_ms` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_rate_limits_key_window_unique` ON `auth_rate_limits` (`key`,`window_ms`);--> statement-breakpoint
CREATE INDEX `auth_rate_limits_updated_at_idx` ON `auth_rate_limits` (`updated_at`);--> statement-breakpoint
CREATE INDEX `auth_rate_limits_window_start_idx` ON `auth_rate_limits` (`window_start_ms`);