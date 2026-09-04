import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

type SqliteDatabase = InstanceType<typeof Database>;

let sqlite: SqliteDatabase | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function databasePath() {
  return process.env.LABELATOR_DB_PATH || path.join(process.cwd(), "data", "labelator.db");
}

export function getDb() {
  if (db) return db;
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'none',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      labels_generated INTEGER NOT NULL DEFAULT 0,
      job_count INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      company_name TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_name TEXT NOT NULL,
      template_version_id TEXT NOT NULL,
      template_version_number INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      source_type TEXT NOT NULL,
      file_name TEXT,
      page_size TEXT,
      error TEXT,
      row_count INTEGER,
      success_count INTEGER,
      failed_count INTEGER,
      output_type TEXT
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      user_id TEXT,
      user_name TEXT,
      type TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      label_count INTEGER NOT NULL DEFAULT 0,
      version_number INTEGER
    );
  `);
  const extraColumns = [
    "ALTER TABLE organizations ADD COLUMN description TEXT",
    "ALTER TABLE organizations ADD COLUMN company_name TEXT",
    "ALTER TABLE jobs ADD COLUMN row_count INTEGER",
    "ALTER TABLE jobs ADD COLUMN success_count INTEGER",
    "ALTER TABLE jobs ADD COLUMN failed_count INTEGER",
    "ALTER TABLE jobs ADD COLUMN output_type TEXT",
  ];
  for (const statement of extraColumns) {
    try {
      sqlite.exec(statement);
    } catch {
      /* column already exists on this install */
    }
  }
  db = drizzle(sqlite, { schema });
  return db;
}
