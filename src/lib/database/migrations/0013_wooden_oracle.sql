-- Normalize existing emails to match auth lookup behavior.
UPDATE `users`
SET `email` = lower(trim(`email`))
WHERE `email` IS NOT NULL
	AND `email` != lower(trim(`email`));
--> statement-breakpoint
-- Enforce global case-insensitive uniqueness for email identity.
CREATE UNIQUE INDEX `users_email_normalized_unique`
ON `users` (lower(trim(`email`)))
WHERE `email` IS NOT NULL AND trim(`email`) <> '';
--> statement-breakpoint
-- Multi-client membership table. One user can belong to many clients.
CREATE TABLE `user_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`role` text DEFAULT 'player' NOT NULL,
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
CREATE UNIQUE INDEX `user_clients_user_client_unique`
ON `user_clients` (`user_id`, `client_id`);
--> statement-breakpoint
CREATE INDEX `user_clients_user_id_idx` ON `user_clients` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_clients_client_id_idx` ON `user_clients` (`client_id`);
--> statement-breakpoint
CREATE INDEX `user_clients_default_idx` ON `user_clients` (`user_id`, `is_default`);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_clients_one_default_per_user`
ON `user_clients` (`user_id`)
WHERE `is_default` = 1 AND `status` = 'active';
--> statement-breakpoint
-- Backfill memberships from legacy users.client_id.
INSERT INTO `user_clients` (
	`id`,
	`user_id`,
	`client_id`,
	`role`,
	`status`,
	`is_default`,
	`created_at`,
	`updated_at`,
	`created_user`,
	`updated_user`
)
SELECT
	lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))) AS `id`,
	u.`id` AS `user_id`,
	u.`client_id` AS `client_id`,
	coalesce(nullif(trim(u.`role`), ''), 'player') AS `role`,
	coalesce(nullif(trim(u.`status`), ''), 'active') AS `status`,
	CASE
		WHEN coalesce(nullif(trim(u.`status`), ''), 'active') = 'active' THEN 1
		ELSE 0
	END AS `is_default`,
	coalesce(u.`created_at`, CURRENT_TIMESTAMP) AS `created_at`,
	coalesce(u.`updated_at`, coalesce(u.`created_at`, CURRENT_TIMESTAMP)) AS `updated_at`,
	u.`created_user` AS `created_user`,
	coalesce(u.`updated_user`, u.`created_user`) AS `updated_user`
FROM `users` u
INNER JOIN `clients` c ON c.`id` = u.`client_id`
WHERE u.`client_id` IS NOT NULL
	AND trim(u.`client_id`) <> ''
	AND NOT EXISTS (
		SELECT 1
		FROM `user_clients` uc
		WHERE uc.`user_id` = u.`id`
			AND uc.`client_id` = u.`client_id`
	);
