ALTER TABLE `pull_requests` ADD `github_updated_at` integer;--> statement-breakpoint
CREATE INDEX `pr_github_updated_at_idx` ON `pull_requests` (`github_updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `pr_reviews_github_id_idx` ON `pr_reviews` (`github_id`);--> statement-breakpoint
UPDATE `pr_files` SET `patch` = NULL WHERE `patch` IS NOT NULL;
