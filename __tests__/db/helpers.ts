/**
 * Test helpers for the data layer.
 *
 * Creates a real in-memory SQLite database using better-sqlite3 (Node.js),
 * wrapped behind the same DBHandle interface the repositories expect.
 * This lets repository tests run real SQL without any mock fragility.
 */

import BetterSqlite from 'better-sqlite3';
import type {DBHandle, SQLArg} from '../../src/db/types';
import {runMigrations} from '../../src/db/schema';

/**
 * Wraps a better-sqlite3 in-memory database as a DBHandle.
 *
 * Routing logic:
 *  - SELECT / PRAGMA / WITH  → stmt.all() (returns rows)
 *  - Everything else         → stmt.run() (INSERT / UPDATE / DELETE / DDL)
 */
function wrapBetterSqlite(underlying: BetterSqlite.Database): DBHandle {
  return {
    execute(sql: string, args: SQLArg[] = []): {rows: Record<string, unknown>[]} {
      const stmt = underlying.prepare(sql);
      if (stmt.reader) {
        return {rows: stmt.all(...args) as Record<string, unknown>[]};
      }
      stmt.run(...args);
      return {rows: []};
    },
  };
}

/**
 * Return a fresh, migrated in-memory DBHandle for each test.
 * Call in beforeEach so tests are fully isolated.
 */
export function makeTestHandle(): DBHandle {
  const underlying = new BetterSqlite(':memory:');
  const handle = wrapBetterSqlite(underlying);
  runMigrations(handle);
  return handle;
}
