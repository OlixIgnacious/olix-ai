/**
 * CRUD operations for the messages table.
 *
 * Accepts a DBHandle so it can be driven by the production op-sqlite
 * connection or a better-sqlite3 test adapter without any mock ceremony.
 */

import {v4 as uuidv4} from 'uuid';
import type {DBHandle, Message, SQLArg} from './types';

// ─── Row type (snake_case columns → camelCase domain) ─────────────────────────

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: number;
};

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: row.created_at,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class MessageRepository {
  constructor(private readonly db: DBHandle) {}

  /** Insert a message and return the full record. */
  create(conversationId: string, role: 'user' | 'assistant', content: string): Message {
    const id = uuidv4();
    const now = Date.now();
    this.db.execute(
      'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, conversationId, role, content, now],
    );
    return {id, conversationId, role, content, createdAt: now};
  }

  /** All messages for a conversation in chronological order. */
  findByConversation(conversationId: string): Message[] {
    const {rows} = this.db.execute(
      'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId as SQLArg],
    );
    return ((rows ?? []) as MessageRow[]).map(toMessage);
  }

  /**
   * Delete all messages belonging to a conversation.
   * Normally handled automatically by the ON DELETE CASCADE constraint;
   * useful for manual cleanup (e.g. "clear chat" without deleting the conversation).
   */
  deleteByConversation(conversationId: string): void {
    this.db.execute('DELETE FROM messages WHERE conversation_id = ?', [conversationId as SQLArg]);
  }
}
