export const SCHEMA_DESCRIPTION = `
The SQLite database has the following tables:

1. repos
   - id: integer (primary key, auto-increment)
   - owner: text (GitHub org/user, e.g. "acme")
   - name: text (repo name, e.g. "backend")
   - full_name: text (unique, e.g. "acme/backend")
   - added_at: integer (unix timestamp)
   - last_synced_at: integer (unix timestamp, nullable)
   - sync_cursor: text (nullable, internal pagination cursor)

2. users
   - id: integer (primary key, auto-increment)
   - github_login: text (unique, e.g. "octocat")
   - github_id: integer (nullable)
   - avatar_url: text (nullable)
   - first_seen_at: integer (unix timestamp)

3. pull_requests
   - id: integer (primary key, auto-increment)
   - github_id: integer (unique, GitHub's node ID)
   - repo_id: integer (foreign key -> repos.id)
   - number: integer (PR number within repo)
   - title: text
   - author_id: integer (foreign key -> users.id, nullable)
   - state: text (one of: "OPEN", "MERGED", "CLOSED")
   - is_draft: integer (0 or 1)
   - created_at: integer (unix timestamp)
   - published_at: integer (unix timestamp, nullable — when draft was marked ready)
   - merged_at: integer (unix timestamp, nullable)
   - closed_at: integer (unix timestamp, nullable)
   - additions: integer (raw line additions)
   - deletions: integer (raw line deletions)
   - changed_files: integer
   - filtered_additions: integer (additions after excluding glob-matched files — prefer this over additions)
   - filtered_deletions: integer (deletions after excluding glob-matched files — prefer this over deletions)
   - url: text (GitHub PR URL, nullable)

4. pr_files
   - id: integer (primary key, auto-increment)
   - pr_id: integer (foreign key -> pull_requests.id)
   - filename: text (file path within the repo)
   - status: text (nullable, e.g. "added", "modified", "removed")
   - additions: integer
   - deletions: integer
   - is_excluded: integer (0 or 1 — whether this file is excluded by glob patterns)
   - patch: text (nullable, diff patch)

5. pr_reviews
   - id: integer (primary key, auto-increment)
   - pr_id: integer (foreign key -> pull_requests.id)
   - reviewer_id: integer (foreign key -> users.id, nullable)
   - state: text (e.g. "APPROVED", "CHANGES_REQUESTED", "COMMENTED")
   - submitted_at: integer (unix timestamp, nullable)
   - github_id: integer (nullable)

6. sync_jobs
   - id: integer (primary key, auto-increment)
   - repo_id: integer (foreign key -> repos.id, nullable)
   - status: text (one of: "PENDING", "RUNNING", "COMPLETED", "FAILED")
   - started_at: integer (unix timestamp)
   - completed_at: integer (unix timestamp, nullable)
   - prs_processed: integer (default 0)
   - error: text (nullable)

7. settings
   - key: text (primary key)
   - value: text (nullable)
   NOTE: The settings table is off-limits. Do not query it.

Common JOIN patterns:
- pull_requests JOIN users ON pull_requests.author_id = users.id
- pull_requests JOIN repos ON pull_requests.repo_id = repos.id
- pr_reviews JOIN users ON pr_reviews.reviewer_id = users.id
- pr_files JOIN pull_requests ON pr_files.pr_id = pull_requests.id

All timestamps are unix epoch seconds (not milliseconds).
When computing PR size, prefer filtered_additions and filtered_deletions over raw additions/deletions.
`.trim();
