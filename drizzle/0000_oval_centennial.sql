CREATE TABLE "app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" integer NOT NULL,
	"github_login" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"email" text,
	"created_at" integer NOT NULL,
	"last_login_at" integer
);
--> statement-breakpoint
CREATE TABLE "claude_code_model_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"usage_id" integer NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"cache_read_tokens" integer DEFAULT 0,
	"cache_creation_tokens" integer DEFAULT 0,
	"estimated_cost_cents" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "claude_code_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer,
	"user_id" integer,
	"email" text NOT NULL,
	"date" text NOT NULL,
	"num_sessions" integer DEFAULT 0,
	"lines_added" integer DEFAULT 0,
	"lines_removed" integer DEFAULT 0,
	"commits_by_claude_code" integer DEFAULT 0,
	"prs_by_claude_code" integer DEFAULT 0,
	"edit_tool_accepted" integer DEFAULT 0,
	"edit_tool_rejected" integer DEFAULT 0,
	"write_tool_accepted" integer DEFAULT 0,
	"write_tool_rejected" integer DEFAULT 0,
	"multi_edit_tool_accepted" integer DEFAULT 0,
	"multi_edit_tool_rejected" integer DEFAULT 0,
	"notebook_edit_tool_accepted" integer DEFAULT 0,
	"notebook_edit_tool_rejected" integer DEFAULT 0,
	"total_input_tokens" integer DEFAULT 0,
	"total_output_tokens" integer DEFAULT 0,
	"estimated_cost_cents" integer DEFAULT 0,
	"terminal_type" text
);
--> statement-breakpoint
CREATE TABLE "jira_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer,
	"jira_key" text NOT NULL,
	"project_key" text NOT NULL,
	"summary" text NOT NULL,
	"issue_type" text,
	"priority" text,
	"status" text NOT NULL,
	"assignee_email" text,
	"assignee_name" text,
	"user_id" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer,
	"resolved_at" integer,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "pr_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"pr_id" integer NOT NULL,
	"filename" text NOT NULL,
	"status" text,
	"additions" integer DEFAULT 0,
	"deletions" integer DEFAULT 0,
	"is_excluded" boolean DEFAULT false NOT NULL,
	"patch" text
);
--> statement-breakpoint
CREATE TABLE "pr_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"pr_id" integer NOT NULL,
	"reviewer_id" integer,
	"state" text NOT NULL,
	"submitted_at" integer,
	"github_id" integer
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" integer NOT NULL,
	"repo_id" integer NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"author_id" integer,
	"state" text NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"created_at" integer NOT NULL,
	"published_at" integer,
	"merged_at" integer,
	"closed_at" integer,
	"additions" integer DEFAULT 0,
	"deletions" integer DEFAULT 0,
	"changed_files" integer DEFAULT 0,
	"filtered_additions" integer DEFAULT 0,
	"filtered_deletions" integer DEFAULT 0,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"added_at" integer NOT NULL,
	"last_synced_at" integer,
	"sync_cursor" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" integer NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer,
	"repo_id" integer,
	"status" text NOT NULL,
	"started_at" integer NOT NULL,
	"completed_at" integer,
	"prs_processed" integer DEFAULT 0,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_login" text NOT NULL,
	"github_id" integer,
	"avatar_url" text,
	"email" text,
	"first_seen_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by" integer,
	"joined_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_pats" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"label" text NOT NULL,
	"encrypted_pat" text NOT NULL,
	"github_login" text,
	"created_by" integer,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"workspace_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" integer NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
ALTER TABLE "claude_code_model_usage" ADD CONSTRAINT "claude_code_model_usage_usage_id_claude_code_usage_id_fk" FOREIGN KEY ("usage_id") REFERENCES "public"."claude_code_usage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_code_usage" ADD CONSTRAINT "claude_code_usage_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_code_usage" ADD CONSTRAINT "claude_code_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jira_issues" ADD CONSTRAINT "jira_issues_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jira_issues" ADD CONSTRAINT "jira_issues_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_files" ADD CONSTRAINT "pr_files_pr_id_pull_requests_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_reviews" ADD CONSTRAINT "pr_reviews_pr_id_pull_requests_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_reviews" ADD CONSTRAINT "pr_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_app_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_pats" ADD CONSTRAINT "workspace_pats_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_pats" ADD CONSTRAINT "workspace_pats_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_github_id_idx" ON "app_users" USING btree ("github_id");--> statement-breakpoint
CREATE INDEX "claude_model_usage_id_idx" ON "claude_code_model_usage" USING btree ("usage_id");--> statement-breakpoint
CREATE INDEX "claude_model_model_idx" ON "claude_code_model_usage" USING btree ("model");--> statement-breakpoint
CREATE UNIQUE INDEX "claude_usage_email_date_idx" ON "claude_code_usage" USING btree ("email","date");--> statement-breakpoint
CREATE INDEX "claude_usage_user_id_idx" ON "claude_code_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "claude_usage_date_idx" ON "claude_code_usage" USING btree ("date");--> statement-breakpoint
CREATE INDEX "claude_usage_workspace_id_idx" ON "claude_code_usage" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jira_key_idx" ON "jira_issues" USING btree ("jira_key");--> statement-breakpoint
CREATE INDEX "jira_project_key_idx" ON "jira_issues" USING btree ("project_key");--> statement-breakpoint
CREATE INDEX "jira_user_id_idx" ON "jira_issues" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jira_status_idx" ON "jira_issues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jira_resolved_at_idx" ON "jira_issues" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "jira_created_at_idx" ON "jira_issues" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jira_workspace_id_idx" ON "jira_issues" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "pr_files_pr_id_idx" ON "pr_files" USING btree ("pr_id");--> statement-breakpoint
CREATE INDEX "pr_files_filename_idx" ON "pr_files" USING btree ("filename");--> statement-breakpoint
CREATE INDEX "pr_reviews_pr_id_idx" ON "pr_reviews" USING btree ("pr_id");--> statement-breakpoint
CREATE INDEX "pr_reviews_reviewer_id_idx" ON "pr_reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "pr_reviews_submitted_at_idx" ON "pr_reviews" USING btree ("submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pr_github_id_idx" ON "pull_requests" USING btree ("github_id");--> statement-breakpoint
CREATE INDEX "pr_repo_id_idx" ON "pull_requests" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "pr_author_id_idx" ON "pull_requests" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "pr_merged_at_idx" ON "pull_requests" USING btree ("merged_at");--> statement-breakpoint
CREATE INDEX "pr_state_idx" ON "pull_requests" USING btree ("state");--> statement-breakpoint
CREATE INDEX "pr_published_at_idx" ON "pull_requests" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_workspace_full_name_idx" ON "repos" USING btree ("workspace_id","full_name");--> statement-breakpoint
CREATE INDEX "repos_workspace_id_idx" ON "repos" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_github_login_idx" ON "users" USING btree ("github_login");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_unique_idx" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_settings_pk_idx" ON "workspace_settings" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspaces" USING btree ("slug");