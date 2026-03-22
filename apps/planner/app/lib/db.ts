import { createDb, type Database } from "@trails-cool/db";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}
