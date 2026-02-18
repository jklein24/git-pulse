import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "productivity.db");

let _readonlyDb: Database.Database | null = null;

export function getReadOnlyDb(): Database.Database {
  if (!_readonlyDb) {
    _readonlyDb = new Database(DB_PATH, { readonly: true });
  }
  return _readonlyDb;
}
