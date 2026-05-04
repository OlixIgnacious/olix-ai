/**
 * Data layer public API.
 *
 * Production consumers use the pre-wired singletons:
 *   import {db} from '@/db';
 *   const conversations = db.conversations.findAll();
 *
 * Call initDb() once at app startup (before any screen renders) and await it.
 * The db proxy will throw if accessed before initDb() resolves.
 *
 * Test files import the repository classes and schema directly, injecting
 * their own DBHandle — they never touch this file.
 */

import {open} from '@op-engineering/op-sqlite';
import {runMigrations} from './schema';
import {ConversationRepository} from './ConversationRepository';
import {MessageRepository} from './MessageRepository';
import {getOrCreateDbKey} from './dbKey';
import type {DBHandle} from './types';

// ─── Public type + value re-exports ──────────────────────────────────────────

export type {Conversation, Message, DBHandle} from './types';
export {ConversationRepository} from './ConversationRepository';
export {MessageRepository} from './MessageRepository';
export {runMigrations} from './schema';

// ─── Singleton production DB ──────────────────────────────────────────────────

type DB = {
  conversations: ConversationRepository;
  messages: MessageRepository;
};

let _db: DB | null = null;

/**
 * Async initialiser — must be awaited before any db access.
 * Safe to call multiple times; subsequent calls are no-ops.
 *
 * On first install the DB is created encrypted. On upgrade from an older
 * unencrypted build, the old DB is deleted and a fresh encrypted one is
 * created (existing conversations are lost, but security is established).
 */
export async function initDb(): Promise<void> {
  if (_db) {
    return;
  }

  const key = await getOrCreateDbKey();

  let raw: ReturnType<typeof open>;
  try {
    raw = open({name: 'olix.db', encryptionKey: key});
    raw.executeSync('SELECT 1');
  } catch {
    // Pre-existing unencrypted DB — delete it and start fresh encrypted.
    try {
      const old = open({name: 'olix.db'});
      old.delete();
    } catch {
      // Already gone or couldn't open — safe to ignore.
    }
    raw = open({name: 'olix.db', encryptionKey: key});
  }

  const conn: DBHandle = {
    execute(sql: string, args?: import('./types').SQLArg[]) {
      return raw.executeSync(sql, args as Parameters<typeof raw.executeSync>[1]);
    },
  };

  runMigrations(conn);
  const conversations = new ConversationRepository(conn);
  conversations.migrateAddPreview();
  _db = {
    conversations,
    messages: new MessageRepository(conn),
  };
}

function getDb(): DB {
  if (!_db) {
    throw new Error('DB not initialised — await initDb() before accessing db');
  }
  return _db;
}

/** Convenience singleton — proxy ensures initDb() has been called first. */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop: keyof DB) {
    return getDb()[prop];
  },
});
