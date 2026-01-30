ALTER TABLE `facilities` RENAME COLUMN "notes" TO "description";--> statement-breakpoint
ALTER TABLE `facility_areas` RENAME COLUMN "code" TO "slug";--> statement-breakpoint
ALTER TABLE `facility_areas` ADD `description` text;