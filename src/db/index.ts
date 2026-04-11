/**
 * Data layer public API.
 *
 * Production consumers use the pre-wired singletons:
 *   import {db} from '@/db';
 *   const conversations = db.conversations.findAll();
 *
 * Test files import the repository classes and schema directly, injecting
 * their own DBHandle — they never touch this file.
 */

import {open} from '@op-engineering/op-sqlite';
import {runMigrations} from './schema';
import {ConversationRepository} from './ConversationRepository';
import {MessageRepository} from './MessageRepository';
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
 * Open (or return the already-open) production SQLite database, running
 * schema migrations on first call.
 *
 * The op-sqlite connection satisfies DBHandle structurally — its execute()
 * return type is a superset of ours.
 */
export function getDb(): DB {
  if (!_db) {
    const conn = open({name: 'olix.db'}) as unknown as DBHandle;
    runMigrations(conn);
    _db = {
      conversations: new ConversationRepository(conn),
      messages: new MessageRepository(conn),
    };
  }
  return _db;
}

/** Convenience singleton for the common case. Initialised lazily on first access. */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop: keyof DB) {
    return getDb()[prop];
  },
});
