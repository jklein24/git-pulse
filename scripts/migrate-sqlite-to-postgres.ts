// @ts-nocheck
import Database from "better-sqlite3";
import postgres from "postgres";

const BATCH_SIZE = 1000;

async function main() {
  const sqlitePath = process.argv[2] || "./data/productivity.db";
  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log(`Reading from SQLite: ${sqlitePath}`);
  console.log(`Writing to Postgres: ${pgUrl.replace(/:[^:@]+@/, ":***@")}`);

  const sqlite = new Database(sqlitePath, { readonly: true });
  const sql = postgres(pgUrl);

  try {
    const ownerLogin = process.argv[3] || "admin";
    const workspaceName = process.argv[4] || "Default Workspace";
    const workspaceSlug = process.argv[5] || "default";
    const now = Math.floor(Date.now() / 1000);

    console.log(`\nCreating app user (login: ${ownerLogin}) and workspace (${workspaceName})...`);

    const [appUser] = await sql`
      INSERT INTO app_users (github_id, github_login, display_name, created_at)
      VALUES (0, ${ownerLogin}, ${ownerLogin}, ${now})
      ON CONFLICT (github_id) DO UPDATE SET github_login = EXCLUDED.github_login
      RETURNING id
    `;

    const [workspace] = await sql`
      INSERT INTO workspaces (name, slug, created_at, created_by)
      VALUES (${workspaceName}, ${workspaceSlug}, ${now}, ${appUser.id})
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;

    await sql`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (${workspace.id}, ${appUser.id}, 'admin', ${now})
      ON CONFLICT (workspace_id, user_id) DO NOTHING
    `;

    console.log(`  App user id: ${appUser.id}, Workspace id: ${workspace.id}`);

    // Migrate settings → workspace_settings
    const settingsRows = sqlite.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string | null }>;
    if (settingsRows.length > 0) {
      console.log(`\nMigrating ${settingsRows.length} settings...`);
      for (const row of settingsRows) {
        await sql`
          INSERT INTO workspace_settings (workspace_id, key, value)
          VALUES (${workspace.id}, ${row.key}, ${row.value})
          ON CONFLICT (workspace_id, key) DO UPDATE SET value = EXCLUDED.value
        `;
      }
    }

    // Migrate users
    const userRows = sqlite.prepare("SELECT * FROM users").all() as Array<Record<string, unknown>>;
    console.log(`\nMigrating ${userRows.length} users...`);
    for (let i = 0; i < userRows.length; i += BATCH_SIZE) {
      const batch = userRows.slice(i, i + BATCH_SIZE);
      await sql`
        INSERT INTO users ${sql(batch.map((r) => ({
          id: r.id,
          github_login: r.github_login,
          github_id: r.github_id,
          avatar_url: r.avatar_url,
          email: r.email,
          first_seen_at: r.first_seen_at,
        })))}
        ON CONFLICT (github_login) DO UPDATE SET
          avatar_url = EXCLUDED.avatar_url,
          email = EXCLUDED.email
      `;
    }

    // Migrate repos (adding workspace_id)
    const repoRows = sqlite.prepare("SELECT * FROM repos").all() as Array<Record<string, unknown>>;
    console.log(`Migrating ${repoRows.length} repos...`);
    for (const r of repoRows) {
      await sql`
        INSERT INTO repos (id, workspace_id, owner, name, full_name, added_at, last_synced_at, sync_cursor)
        VALUES (${r.id}, ${workspace.id}, ${r.owner}, ${r.name}, ${r.full_name}, ${r.added_at}, ${r.last_synced_at}, ${r.sync_cursor})
        ON CONFLICT (workspace_id, full_name) DO UPDATE SET
          last_synced_at = EXCLUDED.last_synced_at,
          sync_cursor = EXCLUDED.sync_cursor
      `;
    }

    // Migrate pull_requests
    const prRows = sqlite.prepare("SELECT * FROM pull_requests").all() as Array<Record<string, unknown>>;
    console.log(`Migrating ${prRows.length} pull requests...`);
    for (let i = 0; i < prRows.length; i += BATCH_SIZE) {
      const batch = prRows.slice(i, i + BATCH_SIZE);
      await sql`
        INSERT INTO pull_requests ${sql(batch.map((r) => ({
          id: r.id,
          github_id: r.github_id,
          repo_id: r.repo_id,
          number: r.number,
          title: r.title,
          author_id: r.author_id,
          state: r.state,
          is_draft: r.is_draft === 1,
          created_at: r.created_at,
          published_at: r.published_at,
          merged_at: r.merged_at,
          closed_at: r.closed_at,
          additions: r.additions,
          deletions: r.deletions,
          changed_files: r.changed_files,
          filtered_additions: r.filtered_additions,
          filtered_deletions: r.filtered_deletions,
          url: r.url,
        })))}
        ON CONFLICT (github_id) DO NOTHING
      `;
      if (i > 0 && i % 5000 === 0) console.log(`  ...${i}/${prRows.length}`);
    }

    // Migrate pr_files
    const fileRows = sqlite.prepare("SELECT * FROM pr_files").all() as Array<Record<string, unknown>>;
    console.log(`Migrating ${fileRows.length} PR files...`);
    for (let i = 0; i < fileRows.length; i += BATCH_SIZE) {
      const batch = fileRows.slice(i, i + BATCH_SIZE);
      await sql`
        INSERT INTO pr_files ${sql(batch.map((r) => ({
          id: r.id,
          pr_id: r.pr_id,
          filename: r.filename,
          status: r.status,
          additions: r.additions,
          deletions: r.deletions,
          is_excluded: r.is_excluded === 1,
          patch: r.patch,
        })))}
        ON CONFLICT DO NOTHING
      `;
      if (i > 0 && i % 5000 === 0) console.log(`  ...${i}/${fileRows.length}`);
    }

    // Migrate pr_reviews
    const reviewRows = sqlite.prepare("SELECT * FROM pr_reviews").all() as Array<Record<string, unknown>>;
    console.log(`Migrating ${reviewRows.length} PR reviews...`);
    for (let i = 0; i < reviewRows.length; i += BATCH_SIZE) {
      const batch = reviewRows.slice(i, i + BATCH_SIZE);
      await sql`
        INSERT INTO pr_reviews ${sql(batch.map((r) => ({
          id: r.id,
          pr_id: r.pr_id,
          reviewer_id: r.reviewer_id,
          state: r.state,
          submitted_at: r.submitted_at,
          github_id: r.github_id,
        })))}
        ON CONFLICT DO NOTHING
      `;
      if (i > 0 && i % 5000 === 0) console.log(`  ...${i}/${reviewRows.length}`);
    }

    // Migrate sync_jobs (adding workspace_id)
    const syncRows = sqlite.prepare("SELECT * FROM sync_jobs").all() as Array<Record<string, unknown>>;
    console.log(`Migrating ${syncRows.length} sync jobs...`);
    for (let i = 0; i < syncRows.length; i += BATCH_SIZE) {
      const batch = syncRows.slice(i, i + BATCH_SIZE);
      await sql`
        INSERT INTO sync_jobs ${sql(batch.map((r) => ({
          id: r.id,
          workspace_id: workspace.id,
          repo_id: r.repo_id,
          status: r.status,
          started_at: r.started_at,
          completed_at: r.completed_at,
          prs_processed: r.prs_processed,
          error: r.error,
        })))}
        ON CONFLICT DO NOTHING
      `;
    }

    // Migrate claude_code_usage (adding workspace_id)
    let hasClaudeTable = false;
    try {
      sqlite.prepare("SELECT count(*) FROM claude_code_usage").get();
      hasClaudeTable = true;
    } catch {}

    if (hasClaudeTable) {
      const claudeRows = sqlite.prepare("SELECT * FROM claude_code_usage").all() as Array<Record<string, unknown>>;
      console.log(`Migrating ${claudeRows.length} Claude usage records...`);
      for (let i = 0; i < claudeRows.length; i += BATCH_SIZE) {
        const batch = claudeRows.slice(i, i + BATCH_SIZE);
        await sql`
          INSERT INTO claude_code_usage ${sql(batch.map((r) => ({
            id: r.id,
            workspace_id: workspace.id,
            user_id: r.user_id,
            email: r.email,
            date: r.date,
            num_sessions: r.num_sessions,
            lines_added: r.lines_added,
            lines_removed: r.lines_removed,
            commits_by_claude_code: r.commits_by_claude_code,
            prs_by_claude_code: r.prs_by_claude_code,
            edit_tool_accepted: r.edit_tool_accepted,
            edit_tool_rejected: r.edit_tool_rejected,
            write_tool_accepted: r.write_tool_accepted,
            write_tool_rejected: r.write_tool_rejected,
            multi_edit_tool_accepted: r.multi_edit_tool_accepted,
            multi_edit_tool_rejected: r.multi_edit_tool_rejected,
            notebook_edit_tool_accepted: r.notebook_edit_tool_accepted,
            notebook_edit_tool_rejected: r.notebook_edit_tool_rejected,
            total_input_tokens: r.total_input_tokens,
            total_output_tokens: r.total_output_tokens,
            estimated_cost_cents: r.estimated_cost_cents,
            terminal_type: r.terminal_type,
          })))}
          ON CONFLICT (email, date) DO NOTHING
        `;
      }

      // Migrate claude_code_model_usage
      let hasModelTable = false;
      try {
        sqlite.prepare("SELECT count(*) FROM claude_code_model_usage").get();
        hasModelTable = true;
      } catch {}

      if (hasModelTable) {
        const modelRows = sqlite.prepare("SELECT * FROM claude_code_model_usage").all() as Array<Record<string, unknown>>;
        console.log(`Migrating ${modelRows.length} Claude model usage records...`);
        for (let i = 0; i < modelRows.length; i += BATCH_SIZE) {
          const batch = modelRows.slice(i, i + BATCH_SIZE);
          await sql`
            INSERT INTO claude_code_model_usage ${sql(batch.map((r) => ({
              id: r.id,
              usage_id: r.usage_id,
              model: r.model,
              input_tokens: r.input_tokens,
              output_tokens: r.output_tokens,
              cache_read_tokens: r.cache_read_tokens,
              cache_creation_tokens: r.cache_creation_tokens,
              estimated_cost_cents: r.estimated_cost_cents,
            })))}
            ON CONFLICT DO NOTHING
          `;
        }
      }
    }

    // Reset Postgres sequences after explicit ID inserts
    console.log("\nResetting sequences...");
    const tables = [
      "users", "repos", "pull_requests", "pr_files", "pr_reviews",
      "sync_jobs", "claude_code_usage", "claude_code_model_usage",
      "app_users", "workspaces", "workspace_members",
    ];
    for (const table of tables) {
      try {
        await sql`SELECT setval(pg_get_serial_sequence(${table}, 'id'), coalesce(max(id), 0) + 1, false) FROM ${sql(table)}`;
      } catch {}
    }

    // Verify counts
    console.log("\nVerification:");
    const counts: Array<[string, number, number]> = [];
    for (const table of ["users", "repos", "pull_requests", "pr_files", "pr_reviews", "sync_jobs"]) {
      const sqliteCount = (sqlite.prepare(`SELECT count(*) as c FROM ${table}`).get() as { c: number }).c;
      const pgResult = await sql`SELECT count(*)::integer as c FROM ${sql(table)}`;
      counts.push([table, sqliteCount, pgResult[0].c]);
    }

    for (const [table, sqliteCount, pgCount] of counts) {
      const match = sqliteCount === pgCount ? "OK" : "MISMATCH";
      console.log(`  ${table}: SQLite=${sqliteCount} Postgres=${pgCount} [${match}]`);
    }

    console.log("\nMigration complete!");
  } finally {
    sqlite.close();
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
