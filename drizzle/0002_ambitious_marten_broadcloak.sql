CREATE TABLE `jira_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jira_key` text NOT NULL,
	`project_key` text NOT NULL,
	`summary` text NOT NULL,
	`issue_type` text,
	`priority` text,
	`status` text NOT NULL,
	`assignee_email` text,
	`assignee_name` text,
	`user_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`resolved_at` integer,
	`url` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_key_idx` ON `jira_issues` (`jira_key`);--> statement-breakpoint
CREATE INDEX `jira_project_key_idx` ON `jira_issues` (`project_key`);--> statement-breakpoint
CREATE INDEX `jira_user_id_idx` ON `jira_issues` (`user_id`);--> statement-breakpoint
CREATE INDEX `jira_status_idx` ON `jira_issues` (`status`);--> statement-breakpoint
CREATE INDEX `jira_resolved_at_idx` ON `jira_issues` (`resolved_at`);--> statement-breakpoint
CREATE INDEX `jira_created_at_idx` ON `jira_issues` (`created_at`);