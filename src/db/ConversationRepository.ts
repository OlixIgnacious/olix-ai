/**
 * CRUD operations for the conversations table.
 *
 * Accepts a DBHandle so it can be driven by the production op-sqlite
 * connection or a better-sqlite3 test adapter without any mock ceremony.
 */

import {v4 as uuidv4} from 'uuid';
import type {Conversation, DBHandle, SQLArg} from './types';

// ─── Row type (snake_case columns → camelCase domain) ─────────────────────────

type ConversationRow = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
};

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class ConversationRepository {
  constructor(private readonly db: DBHandle) {}

  /** Insert a new conversation and return the full record. */
  create(title: string): Conversation {
    const id = uuidv4();
    const now = Date.now();
    this.db.execute(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [id, title, now, now],
    );
    return {id, title, createdAt: now, updatedAt: now};
  }

  /** All conversations, newest activity first. */
  findAll(): Conversation[] {
    const {rows} = this.db.execute(
      'SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC',
    );
    return (rows as ConversationRow[]).map(toConversation);
  }

  /** Single conversation by ID, or null if it does not exist. */
  findById(id: string): Conversation | null {
    const {rows} = this.db.execute(
      'SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?',
      [id as SQLArg],
    );
    const row = rows[0] as ConversationRow | undefined;
    return row ? toConversation(row) : null;
  }

  /** Rename a conversation. */
  updateTitle(id: string, title: string): void {
    this.db.execute('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [
      title,
      Date.now(),
      id,
    ]);
  }

  /**
   * Bump updated_at to now, surfacing this conversation to the top of the
   * list. Call after appending a new message.
   */
  touch(id: string): void {
    this.db.execute('UPDATE conversations SET updated_at = ? WHERE id = ?', [Date.now(), id]);
  }

  /** Delete a conversation and all its messages (CASCADE handles the FK). */
  delete(id: string): void {
    this.db.execute('DELETE FROM conversations WHERE id = ?', [id as SQLArg]);
  }

  /** Delete every conversation and all their messages. */
  deleteAll(): void {
    this.db.execute('DELETE FROM conversations');
  }
}
