CREATE TABLE `communication_message_manual_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `communication_message_manual_recipients_message_order_idx` ON `communication_message_manual_recipients` (`message_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `communication_message_manual_recipients_message_email_idx` ON `communication_message_manual_recipients` (`message_id`,`email`);