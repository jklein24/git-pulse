CREATE TABLE `pr_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_id` integer NOT NULL,
	`filename` text NOT NULL,
	`status` text,
	`additions` integer DEFAULT 0,
	`deletions` integer DEFAULT 0,
	`is_excluded` integer DEFAULT false NOT NULL,
	`patch` text,
	FOREIGN KEY (`pr_id`) REFERENCES `pull_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pr_files_pr_id_idx` ON `pr_files` (`pr_id`);--> statement-breakpoint
CREATE INDEX `pr_files_filename_idx` ON `pr_files` (`filename`);--> statement-breakpoint
CREATE TABLE `pr_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_id` integer NOT NULL,
	`reviewer_id` integer,
	`state` text NOT NULL,
	`submitted_at` integer,
	`github_id` integer,
	FOREIGN KEY (`pr_id`) REFERENCES `pull_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pr_reviews_pr_id_idx` ON `pr_reviews` (`pr_id`);--> statement-breakpoint
CREATE INDEX `pr_reviews_reviewer_id_idx` ON `pr_reviews` (`reviewer_id`);--> statement-breakpoint
CREATE INDEX `pr_reviews_submitted_at_idx` ON `pr_reviews` (`submitted_at`);--> statement-breakpoint
CREATE TABLE `pull_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`github_id` integer NOT NULL,
	`repo_id` integer NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`author_id` integer,
	`state` text NOT NULL,
	`is_draft` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer,
	`merged_at` integer,
	`closed_at` integer,
	`additions` integer DEFAULT 0,
	`deletions` integer DEFAULT 0,
	`changed_files` integer DEFAULT 0,
	`filtered_additions` integer DEFAULT 0,
	`filtered_deletions` integer DEFAULT 0,
	`url` text,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pr_github_id_idx` ON `pull_requests` (`github_id`);--> statement-breakpoint
CREATE INDEX `pr_repo_id_idx` ON `pull_requests` (`repo_id`);--> statement-breakpoint
CREATE INDEX `pr_author_id_idx` ON `pull_requests` (`author_id`);--> statement-breakpoint
CREATE INDEX `pr_merged_at_idx` ON `pull_requests` (`merged_at`);--> statement-breakpoint
CREATE INDEX `pr_state_idx` ON `pull_requests` (`state`);--> statement-breakpoint
CREATE INDEX `pr_published_at_idx` ON `pull_requests` (`published_at`);--> statement-breakpoint
CREATE TABLE `repos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`added_at` integer NOT NULL,
	`last_synced_at` integer,
	`sync_cursor` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repos_full_name_idx` ON `repos` (`full_name`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `sync_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo_id` integer,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`prs_processed` integer DEFAULT 0,
	`error` text,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`github_login` text NOT NULL,
	`github_id` integer,
	`avatar_url` text,
	`first_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_login_idx` ON `users` (`github_login`);