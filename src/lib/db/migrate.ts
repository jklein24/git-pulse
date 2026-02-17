import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "productivity.db");
const MIGRATIONS_PATH = path.join(process.cwd(), "drizzle");

export function runMigrations() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_PATH });
  sqlite.close();
}

if (require.main === module) {
  runMigrations();
  console.log("Migrations applied successfully");
}
