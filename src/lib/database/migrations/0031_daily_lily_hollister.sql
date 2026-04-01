CREATE TABLE `club_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`is_current` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_seasons_client_slug_unique` ON `club_seasons` (`client_id`,`slug`);--> statement-breakpoint
CREATE TABLE `clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`club_season_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sport` text,
	`description` text,
	`image_url` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`series_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clubs_client_season_slug_unique` ON `clubs` (`client_id`,`club_season_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `clubs_client_season_series_unique` ON `clubs` (`client_id`,`club_season_id`,`series_id`) WHERE "clubs"."series_id" is not null and trim("clubs"."series_id") <> '';--> statement-breakpoint
CREATE TABLE `club_leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`club_season_id` text NOT NULL,
	`club_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`stack_order` integer DEFAULT 1 NOT NULL,
	`description` text,
	`gender` text,
	`reg_start_date` text,
	`reg_end_date` text,
	`season_start_date` text,
	`season_end_date` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_locked` integer DEFAULT 0 NOT NULL,
	`image_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_leagues_club_slug_unique` ON `club_leagues` (`club_id`,`slug`) WHERE "club_leagues"."club_id" is not null and trim("club_leagues"."slug") <> '';--> statement-breakpoint
CREATE TABLE `club_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`club_season_id` text NOT NULL,
	`club_id` text NOT NULL,
	`club_league_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`image_url` text,
	`team_color` text,
	`current_roster_size` integer DEFAULT 0 NOT NULL,
	`date_registered` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `club_team_rosters` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`club_season_id` text NOT NULL,
	`club_id` text NOT NULL,
	`club_team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`roster_status` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`date_joined` text,
	`date_left` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `club_officer_titles` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`club_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`scope` text NOT NULL,
	`is_built_in` integer DEFAULT 0 NOT NULL,
	`is_org_managed` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `club_officer_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`club_season_id` text NOT NULL,
	`club_id` text NOT NULL,
	`club_league_id` text,
	`club_team_id` text,
	`title_id` text NOT NULL,
	`user_id` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `club_events` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`club_season_id` text NOT NULL,
	`club_id` text NOT NULL,
	`club_league_id` text,
	`club_team_id` text,
	`facility_id` text,
	`facility_area_id` text,
	`opponent_name` text,
	`scheduled_start_at` text,
	`scheduled_end_at` text,
	`status` text,
	`result_label` text,
	`notes` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE TABLE `communication_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`editor_json` text,
	`body_html` text DEFAULT '' NOT NULL,
	`body_text` text DEFAULT '' NOT NULL,
	`recipient_count` integer DEFAULT 0 NOT NULL,
	`sent_at` text,
	`failure_message` text,
	`provider_message_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_user` text,
	`updated_user` text
);
--> statement-breakpoint
CREATE INDEX `communication_messages_client_status_idx` ON `communication_messages` (`client_id`,`status`);--> statement-breakpoint
CREATE INDEX `communication_messages_client_updated_idx` ON `communication_messages` (`client_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `communication_message_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`mode` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`filters_json` text NOT NULL,
	`summary_text` text DEFAULT '' NOT NULL,
	`resolved_recipient_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `communication_message_batches_message_order_idx` ON `communication_message_batches` (`message_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `communication_message_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`resolution_metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `communication_message_recipients_message_idx` ON `communication_message_recipients` (`message_id`);--> statement-breakpoint
CREATE INDEX `communication_message_recipients_message_email_idx` ON `communication_message_recipients` (`message_id`,`email`);