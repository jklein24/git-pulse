import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const repos = sqliteTable("repos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  addedAt: integer("added_at").notNull(),
  lastSyncedAt: integer("last_synced_at"),
  syncCursor: text("sync_cursor"),
}, (table) => [
  uniqueIndex("repos_full_name_idx").on(table.fullName),
]);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  githubLogin: text("github_login").notNull(),
  githubId: integer("github_id"),
  avatarUrl: text("avatar_url"),
  firstSeenAt: integer("first_seen_at").notNull(),
}, (table) => [
  uniqueIndex("users_github_login_idx").on(table.githubLogin),
]);

export const pullRequests = sqliteTable("pull_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  githubId: integer("github_id").notNull(),
  repoId: integer("repo_id").notNull().references(() => repos.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  authorId: integer("author_id").references(() => users.id),
  state: text("state").notNull(), // OPEN, MERGED, CLOSED
  isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(false),
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

export const prFiles = sqliteTable("pr_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prId: integer("pr_id").notNull().references(() => pullRequests.id),
  filename: text("filename").notNull(),
  status: text("status"),
  additions: integer("additions").default(0),
  deletions: integer("deletions").default(0),
  isExcluded: integer("is_excluded", { mode: "boolean" }).notNull().default(false),
  patch: text("patch"),
}, (table) => [
  index("pr_files_pr_id_idx").on(table.prId),
  index("pr_files_filename_idx").on(table.filename),
]);

export const prReviews = sqliteTable("pr_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const syncJobs = sqliteTable("sync_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repoId: integer("repo_id").references(() => repos.id),
  status: text("status").notNull(), // PENDING, RUNNING, COMPLETED, FAILED
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  prsProcessed: integer("prs_processed").default(0),
  error: text("error"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});
