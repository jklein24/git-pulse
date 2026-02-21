CREATE TABLE `claude_code_model_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usage_id` integer NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0,
	`output_tokens` integer DEFAULT 0,
	`cache_read_tokens` integer DEFAULT 0,
	`cache_creation_tokens` integer DEFAULT 0,
	`estimated_cost_cents` integer DEFAULT 0,
	FOREIGN KEY (`usage_id`) REFERENCES `claude_code_usage`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `claude_model_usage_id_idx` ON `claude_code_model_usage` (`usage_id`);--> statement-breakpoint
CREATE INDEX `claude_model_model_idx` ON `claude_code_model_usage` (`model`);--> statement-breakpoint
CREATE TABLE `claude_code_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`email` text NOT NULL,
	`date` text NOT NULL,
	`num_sessions` integer DEFAULT 0,
	`lines_added` integer DEFAULT 0,
	`lines_removed` integer DEFAULT 0,
	`commits_by_claude_code` integer DEFAULT 0,
	`prs_by_claude_code` integer DEFAULT 0,
	`edit_tool_accepted` integer DEFAULT 0,
	`edit_tool_rejected` integer DEFAULT 0,
	`write_tool_accepted` integer DEFAULT 0,
	`write_tool_rejected` integer DEFAULT 0,
	`multi_edit_tool_accepted` integer DEFAULT 0,
	`multi_edit_tool_rejected` integer DEFAULT 0,
	`notebook_edit_tool_accepted` integer DEFAULT 0,
	`notebook_edit_tool_rejected` integer DEFAULT 0,
	`total_input_tokens` integer DEFAULT 0,
	`total_output_tokens` integer DEFAULT 0,
	`estimated_cost_cents` integer DEFAULT 0,
	`terminal_type` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `claude_usage_email_date_idx` ON `claude_code_usage` (`email`,`date`);--> statement-breakpoint
CREATE INDEX `claude_usage_user_id_idx` ON `claude_code_usage` (`user_id`);--> statement-breakpoint
CREATE INDEX `claude_usage_date_idx` ON `claude_code_usage` (`date`);--> statement-breakpoint
ALTER TABLE `users` ADD `email` text;