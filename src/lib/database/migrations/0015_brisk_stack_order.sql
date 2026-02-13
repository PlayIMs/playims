ALTER TABLE `leagues` ADD `stack_order` integer DEFAULT 1;
--> statement-breakpoint
WITH ranked AS (
	SELECT
		`id`,
		ROW_NUMBER() OVER (
			PARTITION BY `offering_id`
			ORDER BY lower(coalesce(`name`, '')), coalesce(`created_at`, ''), `id`
		) AS `next_order`
	FROM `leagues`
)
UPDATE `leagues`
SET `stack_order` = (
	SELECT `next_order`
	FROM ranked
	WHERE ranked.`id` = `leagues`.`id`
)
WHERE `id` IN (SELECT `id` FROM ranked);
