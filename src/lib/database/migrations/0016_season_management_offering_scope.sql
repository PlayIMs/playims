ALTER TABLE `offerings` ADD `season_id` text;
--> statement-breakpoint
WITH season_counts AS (
	SELECT
		`offering_id`,
		MIN(`season_id`) AS `season_id`,
		COUNT(DISTINCT `season_id`) AS `season_count`
	FROM `leagues`
	WHERE `offering_id` IS NOT NULL AND `season_id` IS NOT NULL
	GROUP BY `offering_id`
)
UPDATE `offerings`
SET `season_id` = (
	SELECT `season_id`
	FROM season_counts
	WHERE season_counts.`offering_id` = `offerings`.`id`
)
WHERE `season_id` IS NULL
	AND `id` IN (
		SELECT `offering_id`
		FROM season_counts
		WHERE `season_count` = 1
	);
--> statement-breakpoint
DROP TABLE IF EXISTS `offering_split_map`;
--> statement-breakpoint
CREATE TABLE `offering_split_map` (
	`old_offering_id` text NOT NULL,
	`season_id` text NOT NULL,
	`new_offering_id` text NOT NULL,
	`row_num` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `offering_split_map` (`old_offering_id`, `season_id`, `new_offering_id`, `row_num`)
SELECT
	base.`offering_id`,
	base.`season_id`,
	lower(hex(randomblob(16))),
	ROW_NUMBER() OVER (PARTITION BY base.`offering_id` ORDER BY base.`season_id`)
FROM (
	SELECT DISTINCT `offering_id`, `season_id`
	FROM `leagues`
	WHERE `offering_id` IS NOT NULL
		AND `season_id` IS NOT NULL
		AND `offering_id` IN (
			SELECT `offering_id`
			FROM `leagues`
			WHERE `offering_id` IS NOT NULL AND `season_id` IS NOT NULL
			GROUP BY `offering_id`
			HAVING COUNT(DISTINCT `season_id`) > 1
		)
) base;
--> statement-breakpoint
UPDATE `offerings`
SET `season_id` = (
	SELECT m.`season_id`
	FROM `offering_split_map` m
	WHERE m.`old_offering_id` = `offerings`.`id` AND m.`row_num` = 1
)
WHERE `season_id` IS NULL
	AND `id` IN (
		SELECT `old_offering_id`
		FROM `offering_split_map`
		WHERE `row_num` = 1
	);
--> statement-breakpoint
INSERT INTO `offerings` (
	`id`,
	`name`,
	`slug`,
	`is_active`,
	`image_url`,
	`min_players`,
	`max_players`,
	`rulebook_url`,
	`sport`,
	`type`,
	`description`,
	`client_id`,
	`season_id`,
	`created_at`,
	`updated_at`,
	`created_user`,
	`updated_user`
)
SELECT
	m.`new_offering_id`,
	o.`name`,
	o.`slug`,
	o.`is_active`,
	o.`image_url`,
	o.`min_players`,
	o.`max_players`,
	o.`rulebook_url`,
	o.`sport`,
	o.`type`,
	o.`description`,
	o.`client_id`,
	m.`season_id`,
	o.`created_at`,
	o.`updated_at`,
	o.`created_user`,
	o.`updated_user`
FROM `offering_split_map` m
JOIN `offerings` o ON o.`id` = m.`old_offering_id`
WHERE m.`row_num` > 1;
--> statement-breakpoint
UPDATE `leagues`
SET `offering_id` = (
	SELECT m.`new_offering_id`
	FROM `offering_split_map` m
	WHERE m.`old_offering_id` = `leagues`.`offering_id`
		AND m.`season_id` = `leagues`.`season_id`
		AND m.`row_num` > 1
)
WHERE EXISTS (
	SELECT 1
	FROM `offering_split_map` m
	WHERE m.`old_offering_id` = `leagues`.`offering_id`
		AND m.`season_id` = `leagues`.`season_id`
		AND m.`row_num` > 1
);
--> statement-breakpoint
UPDATE `events`
SET `offering_id` = (
	SELECT `offering_id`
	FROM `leagues`
	WHERE `leagues`.`id` = `events`.`league_id`
)
WHERE `league_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `offerings`
SET `season_id` = (
	SELECT s.`id`
	FROM `seasons` s
	WHERE s.`client_id` = `offerings`.`client_id`
	ORDER BY s.`is_current` DESC, s.`start_date` DESC, s.`created_at` DESC
	LIMIT 1
)
WHERE `season_id` IS NULL;
--> statement-breakpoint
WITH ranked AS (
	SELECT
		`id`,
		ROW_NUMBER() OVER (
			PARTITION BY `client_id`, `season_id`, lower(coalesce(`slug`, ''))
			ORDER BY coalesce(`created_at`, ''), `id`
		) AS `slug_rank`
	FROM `offerings`
	WHERE `slug` IS NOT NULL AND trim(`slug`) <> ''
)
UPDATE `offerings`
SET `slug` = `slug` || '-' || (
	SELECT `slug_rank`
	FROM ranked
	WHERE ranked.`id` = `offerings`.`id`
)
WHERE `id` IN (
	SELECT `id`
	FROM ranked
	WHERE `slug_rank` > 1
);
--> statement-breakpoint
DROP TABLE `offering_split_map`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `offerings_client_season_slug_unique`
	ON `offerings` (`client_id`, `season_id`, `slug`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `delete_batches` (
	`id` text PRIMARY KEY,
	`client_id` text,
	`season_id` text,
	`season_name` text,
	`reason` text,
	`deleted_user` text,
	`deleted_at` text,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `seasons_deleted` AS SELECT * FROM `seasons` WHERE 0;
--> statement-breakpoint
ALTER TABLE `seasons_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `seasons_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `seasons_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `seasons_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `offerings_deleted` AS SELECT * FROM `offerings` WHERE 0;
--> statement-breakpoint
ALTER TABLE `offerings_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `offerings_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `offerings_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `offerings_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `leagues_deleted` AS SELECT * FROM `leagues` WHERE 0;
--> statement-breakpoint
ALTER TABLE `leagues_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `leagues_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `leagues_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `leagues_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `divisions_deleted` AS SELECT * FROM `divisions` WHERE 0;
--> statement-breakpoint
ALTER TABLE `divisions_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `divisions_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `divisions_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `divisions_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `teams_deleted` AS SELECT * FROM `teams` WHERE 0;
--> statement-breakpoint
ALTER TABLE `teams_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `teams_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `teams_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `teams_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rosters_deleted` AS SELECT * FROM `rosters` WHERE 0;
--> statement-breakpoint
ALTER TABLE `rosters_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `rosters_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `rosters_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `rosters_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `events_deleted` AS SELECT * FROM `events` WHERE 0;
--> statement-breakpoint
ALTER TABLE `events_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `events_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `events_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `events_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `announcements_deleted` AS SELECT * FROM `announcements` WHERE 0;
--> statement-breakpoint
ALTER TABLE `announcements_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `announcements_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `announcements_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `announcements_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `brackets_deleted` AS SELECT * FROM `brackets` WHERE 0;
--> statement-breakpoint
ALTER TABLE `brackets_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `brackets_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `brackets_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `brackets_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `division_standings_deleted` AS SELECT * FROM `division_standings` WHERE 0;
--> statement-breakpoint
ALTER TABLE `division_standings_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `division_standings_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `division_standings_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `division_standings_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bracket_entries_deleted` AS SELECT * FROM `bracket_entries` WHERE 0;
--> statement-breakpoint
ALTER TABLE `bracket_entries_deleted` ADD `deleted_batch_id` text;
--> statement-breakpoint
ALTER TABLE `bracket_entries_deleted` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `bracket_entries_deleted` ADD `deleted_user` text;
--> statement-breakpoint
ALTER TABLE `bracket_entries_deleted` ADD `delete_reason` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `delete_batches_client_season_idx` ON `delete_batches` (`client_id`, `season_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `seasons_deleted_batch_idx` ON `seasons_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `offerings_deleted_batch_idx` ON `offerings_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `leagues_deleted_batch_idx` ON `leagues_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `divisions_deleted_batch_idx` ON `divisions_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `teams_deleted_batch_idx` ON `teams_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `rosters_deleted_batch_idx` ON `rosters_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `events_deleted_batch_idx` ON `events_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `announcements_deleted_batch_idx` ON `announcements_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `brackets_deleted_batch_idx` ON `brackets_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `division_standings_deleted_batch_idx` ON `division_standings_deleted` (`deleted_batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bracket_entries_deleted_batch_idx` ON `bracket_entries_deleted` (`deleted_batch_id`);
