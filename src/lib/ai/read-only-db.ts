import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

export function getReadOnlySql(): ReturnType<typeof postgres> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is required");
    _sql = postgres(url);
  }
  return _sql;
}
