/**
 * SQLite schema and migration runner.
 *
 * Uses CREATE TABLE IF NOT EXISTS so it is safe to call on every app launch.
 * Extend by adding new statements when the schema needs to evolve.
 */

import type {DBHandle} from './types';

// ─── Schema statements ────────────────────────────────────────────────────────

const SCHEMA_STATEMENTS: string[] = [
  // Performance: write-ahead log avoids blocking reads during writes
  'PRAGMA journal_mode=WAL',
  // Safety: enforce FOREIGN KEY constraints (SQLite disables them by default)
  'PRAGMA foreign_keys=ON',

  `CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT    PRIMARY KEY NOT NULL,
    title      TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS messages (
    id              TEXT    PRIMARY KEY NOT NULL,
    conversation_id TEXT    NOT NULL,
    role            TEXT    NOT NULL,
    content         TEXT    NOT NULL,
    created_at      INTEGER NOT NULL,
    FOREIGN KEY (conversation_id)
      REFERENCES conversations(id) ON DELETE CASCADE
  )`,

  // Speeds up the common query: fetch all messages for a conversation ordered by time
  'CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)',
];

// ─── Runner ───────────────────────────────────────────────────────────────────

/** Run all schema statements idempotently. Safe to call on every launch. */
export function runMigrations(db: DBHandle): void {
  for (const sql of SCHEMA_STATEMENTS) {
    db.execute(sql);
  }
}
