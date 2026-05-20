ALTER TABLE `jira_issues` ADD `due_date` integer;--> statement-breakpoint
ALTER TABLE `jira_issues` ADD `parent_key` text;--> statement-breakpoint
CREATE INDEX `jira_parent_key_idx` ON `jira_issues` (`parent_key`);