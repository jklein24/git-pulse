import { pgTable, text, integer, serial, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

// Auth & workspace tables

export const appUsers = pgTable("app_users", {
  id: serial("id").primaryKey(),
  githubId: integer("github_id").notNull(),
  githubLogin: text("github_login").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  email: text("email"),
  createdAt: integer("created_at").notNull(),
  lastLoginAt: integer("last_login_at"),
}, (table) => [
  uniqueIndex("app_users_github_id_idx").on(table.githubId),
]);

export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: integer("created_at").notNull(),
  createdBy: integer("created_by").references(() => appUsers.id),
}, (table) => [
  uniqueIndex("workspaces_slug_idx").on(table.slug),
]);

export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => appUsers.id),
  role: text("role").notNull().default("member"),
  invitedBy: integer("invited_by").references(() => appUsers.id),
  joinedAt: integer("joined_at").notNull(),
}, (table) => [
  uniqueIndex("workspace_members_unique_idx").on(table.workspaceId, table.userId),
]);

export const workspacePats = pgTable("workspace_pats", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  label: text("label").notNull(),
  encryptedPat: text("encrypted_pat").notNull(),
  githubLogin: text("github_login"),
  createdBy: integer("created_by").references(() => appUsers.id),
  createdAt: integer("created_at").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => appUsers.id),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_expires_at_idx").on(table.expiresAt),
]);

// Existing tables (modified with workspaceId where needed)

export const repos = pgTable("repos", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  addedAt: integer("added_at").notNull(),
  lastSyncedAt: integer("last_synced_at"),
  syncCursor: text("sync_cursor"),
}, (table) => [
  uniqueIndex("repos_workspace_full_name_idx").on(table.workspaceId, table.fullName),
  index("repos_workspace_id_idx").on(table.workspaceId),
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubLogin: text("github_login").notNull(),
  githubId: integer("github_id"),
  avatarUrl: text("avatar_url"),
  email: text("email"),
  firstSeenAt: integer("first_seen_at").notNull(),
}, (table) => [
  uniqueIndex("users_github_login_idx").on(table.githubLogin),
]);

export const pullRequests = pgTable("pull_requests", {
  id: serial("id").primaryKey(),
  githubId: integer("github_id").notNull(),
  repoId: integer("repo_id").notNull().references(() => repos.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  authorId: integer("author_id").references(() => users.id),
  state: text("state").notNull(),
  isDraft: boolean("is_draft").notNull().default(false),
  createdAt: integer("created_at").notNull(),
  publishedAt: integer("published_at"),
  mergedAt: integer("merged_at"),
  closedAt: integer("closed_at"),
  additions: integer("additions").default(0),
  deletions: integer("deletions").default(0),
  changedFiles: integer("changed_files").default(0),
  filteredAdditions: integer("filtered_additions").default(0),
  filteredDeletions: integer("filtered_deletions").default(0),
  url: text("url"),
}, (table) => [
  uniqueIndex("pr_github_id_idx").on(table.githubId),
  index("pr_repo_id_idx").on(table.repoId),
  index("pr_author_id_idx").on(table.authorId),
  index("pr_merged_at_idx").on(table.mergedAt),
  index("pr_state_idx").on(table.state),
  index("pr_published_at_idx").on(table.publishedAt),
]);

export const prFiles = pgTable("pr_files", {
  id: serial("id").primaryKey(),
  prId: integer("pr_id").notNull().references(() => pullRequests.id),
  filename: text("filename").notNull(),
  status: text("status"),
  additions: integer("additions").default(0),
  deletions: integer("deletions").default(0),
  isExcluded: boolean("is_excluded").notNull().default(false),
  patch: text("patch"),
}, (table) => [
  index("pr_files_pr_id_idx").on(table.prId),
  index("pr_files_filename_idx").on(table.filename),
]);

export const prReviews = pgTable("pr_reviews", {
  id: serial("id").primaryKey(),
  prId: integer("pr_id").notNull().references(() => pullRequests.id),
  reviewerId: integer("reviewer_id").references(() => users.id),
  state: text("state").notNull(),
  submittedAt: integer("submitted_at"),
  githubId: integer("github_id"),
}, (table) => [
  index("pr_reviews_pr_id_idx").on(table.prId),
  index("pr_reviews_reviewer_id_idx").on(table.reviewerId),
  index("pr_reviews_submitted_at_idx").on(table.submittedAt),
]);

export const syncJobs = pgTable("sync_jobs", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  repoId: integer("repo_id").references(() => repos.id),
  status: text("status").notNull(),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  prsProcessed: integer("prs_processed").default(0),
  error: text("error"),
});

export const workspaceSettings = pgTable("workspace_settings", {
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  key: text("key").notNull(),
  value: text("value"),
}, (table) => [
  uniqueIndex("workspace_settings_pk_idx").on(table.workspaceId, table.key),
]);

export const claudeCodeUsage = pgTable("claude_code_usage", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  userId: integer("user_id").references(() => users.id),
  email: text("email").notNull(),
  date: text("date").notNull(),
  numSessions: integer("num_sessions").default(0),
  linesAdded: integer("lines_added").default(0),
  linesRemoved: integer("lines_removed").default(0),
  commitsByClaudeCode: integer("commits_by_claude_code").default(0),
  prsByClaudeCode: integer("prs_by_claude_code").default(0),
  editToolAccepted: integer("edit_tool_accepted").default(0),
  editToolRejected: integer("edit_tool_rejected").default(0),
  writeToolAccepted: integer("write_tool_accepted").default(0),
  writeToolRejected: integer("write_tool_rejected").default(0),
  multiEditToolAccepted: integer("multi_edit_tool_accepted").default(0),
  multiEditToolRejected: integer("multi_edit_tool_rejected").default(0),
  notebookEditToolAccepted: integer("notebook_edit_tool_accepted").default(0),
  notebookEditToolRejected: integer("notebook_edit_tool_rejected").default(0),
  totalInputTokens: integer("total_input_tokens").default(0),
  totalOutputTokens: integer("total_output_tokens").default(0),
  estimatedCostCents: integer("estimated_cost_cents").default(0),
  terminalType: text("terminal_type"),
}, (table) => [
  uniqueIndex("claude_usage_email_date_idx").on(table.email, table.date),
  index("claude_usage_user_id_idx").on(table.userId),
  index("claude_usage_date_idx").on(table.date),
  index("claude_usage_workspace_id_idx").on(table.workspaceId),
]);

export const jiraIssues = pgTable("jira_issues", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  jiraKey: text("jira_key").notNull(),
  projectKey: text("project_key").notNull(),
  summary: text("summary").notNull(),
  issueType: text("issue_type"),
  priority: text("priority"),
  status: text("status").notNull(),
  assigneeEmail: text("assignee_email"),
  assigneeName: text("assignee_name"),
  userId: integer("user_id").references(() => users.id),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at"),
  resolvedAt: integer("resolved_at"),
  url: text("url"),
}, (table) => [
  uniqueIndex("jira_key_idx").on(table.jiraKey),
  index("jira_project_key_idx").on(table.projectKey),
  index("jira_user_id_idx").on(table.userId),
  index("jira_status_idx").on(table.status),
  index("jira_resolved_at_idx").on(table.resolvedAt),
  index("jira_created_at_idx").on(table.createdAt),
  index("jira_workspace_id_idx").on(table.workspaceId),
]);

export const claudeCodeModelUsage = pgTable("claude_code_model_usage", {
  id: serial("id").primaryKey(),
  usageId: integer("usage_id").notNull().references(() => claudeCodeUsage.id),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  cacheReadTokens: integer("cache_read_tokens").default(0),
  cacheCreationTokens: integer("cache_creation_tokens").default(0),
  estimatedCostCents: integer("estimated_cost_cents").default(0),
}, (table) => [
  index("claude_model_usage_id_idx").on(table.usageId),
  index("claude_model_model_idx").on(table.model),
]);
