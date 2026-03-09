ALTER TABLE `offerings` ADD `series_id` text;--> statement-breakpoint
WITH `candidate_slug_updates` AS (
	SELECT
		l.`id` AS `league_id`,
		l.`offering_id` AS `offering_id`,
		substr(l.`slug`, 1, length(l.`slug`) - length(o.`slug`) - 1) AS `new_slug`
	FROM `leagues` l
	INNER JOIN `offerings` o ON o.`id` = l.`offering_id`
	WHERE l.`slug` IS NOT NULL
		AND trim(l.`slug`) <> ''
		AND o.`slug` IS NOT NULL
		AND trim(o.`slug`) <> ''
		AND length(l.`slug`) > length(o.`slug`) + 1
		AND l.`slug` = substr(l.`slug`, 1, length(l.`slug`) - length(o.`slug`) - 1) || '-' || o.`slug`
), `safe_slug_updates` AS (
	SELECT `league_id`, `new_slug`
	FROM (
		SELECT
			c.`league_id`,
			c.`offering_id`,
			c.`new_slug`,
			count(*) OVER (PARTITION BY c.`offering_id`, lower(trim(c.`new_slug`))) AS `candidate_count`
		FROM `candidate_slug_updates` c
	) scoped
	WHERE scoped.`candidate_count` = 1
		AND scoped.`new_slug` IS NOT NULL
		AND trim(scoped.`new_slug`) <> ''
		AND NOT EXISTS (
			SELECT 1
			FROM `leagues` existing
			WHERE existing.`offering_id` = scoped.`offering_id`
				AND existing.`id` <> scoped.`league_id`
				AND lower(trim(existing.`slug`)) = lower(trim(scoped.`new_slug`))
		)
)
UPDATE `leagues`
SET `slug` = (
	SELECT `new_slug`
	FROM `safe_slug_updates`
	WHERE `safe_slug_updates`.`league_id` = `leagues`.`id`
)
WHERE `id` IN (SELECT `league_id` FROM `safe_slug_updates`);--> statement-breakpoint
CREATE UNIQUE INDEX `offerings_client_season_series_unique` ON `offerings` (`client_id`,`season_id`,`series_id`) WHERE "offerings"."series_id" is not null and trim("offerings"."series_id") <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `leagues_offering_slug_unique` ON `leagues` (`offering_id`,`slug`) WHERE "leagues"."offering_id" is not null and "leagues"."slug" is not null and trim("leagues"."slug") <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `divisions_league_slug_unique` ON `divisions` (`league_id`,`slug`) WHERE "divisions"."league_id" is not null and "divisions"."slug" is not null and trim("divisions"."slug") <> '';
