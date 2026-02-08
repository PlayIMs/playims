ALTER TABLE `sports` RENAME TO `offerings`;--> statement-breakpoint
ALTER TABLE `leagues` RENAME COLUMN "sport_id" TO "offering_id";--> statement-breakpoint
ALTER TABLE `events` RENAME COLUMN "sport_id" TO "offering_id";