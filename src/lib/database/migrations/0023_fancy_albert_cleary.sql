CREATE TABLE `member_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`student_id` text,
	`sex` text,
	`role` text DEFAULT 'participant' NOT NULL,
	`mode` text DEFAULT 'invite' NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`accepted_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_invites_token_hash_unique` ON `member_invites` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_invites_pending_email_unique` ON `member_invites` (`client_id`,lower(trim("email"))) WHERE "member_invites"."status" = 'pending' and trim("member_invites"."email") <> '';--> statement-breakpoint
CREATE INDEX `member_invites_client_status_created_idx` ON `member_invites` (`client_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `member_invites_expires_at_idx` ON `member_invites` (`expires_at`);--> statement-breakpoint
ALTER TABLE `user_clients` ADD `student_id` text;--> statement-breakpoint
ALTER TABLE `user_clients` ADD `sex` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_clients_client_student_id_unique` ON `user_clients` (`client_id`,`student_id`) WHERE "user_clients"."student_id" is not null and trim("user_clients"."student_id") <> '';--> statement-breakpoint
CREATE INDEX `user_clients_client_status_user_idx` ON `user_clients` (`client_id`,`status`,`user_id`);--> statement-breakpoint
CREATE INDEX `user_clients_client_status_role_idx` ON `user_clients` (`client_id`,`status`,`role`);--> statement-breakpoint
CREATE INDEX `user_clients_client_status_sex_idx` ON `user_clients` (`client_id`,`status`,`sex`);