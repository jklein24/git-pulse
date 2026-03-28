ALTER TABLE `users` ADD `pod` text;--> statement-breakpoint
ALTER TABLE `users` ADD `team_group` text;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text;--> statement-breakpoint
CREATE INDEX `users_pod_idx` ON `users` (`pod`);
