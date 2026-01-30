ALTER TABLE `facilities` RENAME COLUMN "description" TO "notes";--> statement-breakpoint
ALTER TABLE `facility_areas` ADD `code` text;--> statement-breakpoint
ALTER TABLE `facility_areas` DROP COLUMN `slug`;--> statement-breakpoint
ALTER TABLE `facility_areas` DROP COLUMN `description`;