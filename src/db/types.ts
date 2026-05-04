/**
 * Shared domain types and the DBHandle interface.
 *
 * DBHandle is a structural interface that @op-engineering/op-sqlite satisfies
 * in production and that test helpers implement using better-sqlite3.
 * Repositories only depend on this interface — never on the library directly.
 */

// ─── DB abstraction ───────────────────────────────────────────────────────────

/** Primitive values that can be safely bound to SQLite statement parameters. */
export type SQLArg = string | number | null;

/** Minimal synchronous DB surface the repositories require. */
export interface DBHandle {
  // op-sqlite returns rows as undefined when the result set is empty.
  execute(sql: string, args?: SQLArg[]): {rows: Record<string, unknown>[] | undefined};
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export type Conversation = {
  id: string;
  title: string;
  preview: string | null;
  createdAt: number; // Unix ms
  updatedAt: number; // Unix ms — drives sort order in the list
};

export type Message = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number; // Unix ms
};
