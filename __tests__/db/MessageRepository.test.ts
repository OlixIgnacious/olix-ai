/**
 * Unit tests for MessageRepository.
 *
 * Uses a real in-memory SQLite database (better-sqlite3) via makeTestHandle(),
 * so every assertion exercises actual SQL — not mocked return values.
 */

import {ConversationRepository} from '../../src/db/ConversationRepository';
import {MessageRepository} from '../../src/db/MessageRepository';
import {makeTestHandle} from './helpers';
import type {DBHandle} from '../../src/db/types';

// ─── Setup ────────────────────────────────────────────────────────────────────

let handle: DBHandle;
let convRepo: ConversationRepository;
let msgRepo: MessageRepository;
let convId: string;

beforeEach(() => {
  handle = makeTestHandle();
  convRepo = new ConversationRepository(handle);
  msgRepo = new MessageRepository(handle);
  // Every test gets a fresh parent conversation to write messages into
  convId = convRepo.create('Test conversation').id;
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('create', () => {
  it('returns a message with the given fields', () => {
    const msg = msgRepo.create(convId, 'user', 'Hello!');
    expect(msg.conversationId).toBe(convId);
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello!');
  });

  it('assigns a UUID id', () => {
    const msg = msgRepo.create(convId, 'assistant', 'Hi');
    expect(msg.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('sets createdAt to approximately now', () => {
    const before = Date.now();
    const msg = msgRepo.create(convId, 'user', 'Ping');
    const after = Date.now();
    expect(msg.createdAt).toBeGreaterThanOrEqual(before);
    expect(msg.createdAt).toBeLessThanOrEqual(after);
  });

  it('persists to the database', () => {
    const msg = msgRepo.create(convId, 'user', 'Persisted');
    const messages = msgRepo.findByConversation(convId);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.id).toBe(msg.id);
  });

  it('each call produces a unique id', () => {
    const a = msgRepo.create(convId, 'user', 'A');
    const b = msgRepo.create(convId, 'assistant', 'B');
    expect(a.id).not.toBe(b.id);
  });
});

// ─── findByConversation ───────────────────────────────────────────────────────

describe('findByConversation', () => {
  it('returns an empty array when no messages exist', () => {
    expect(msgRepo.findByConversation(convId)).toEqual([]);
  });

  it('returns only messages for the requested conversation', () => {
    const other = convRepo.create('Other').id;
    msgRepo.create(convId, 'user', 'Mine');
    msgRepo.create(other, 'user', 'Not mine');

    const messages = msgRepo.findByConversation(convId);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe('Mine');
  });

  it('orders messages by createdAt ascending (oldest first)', () => {
    jest.useFakeTimers();
    const t0 = Date.now();
    jest.setSystemTime(t0);
    msgRepo.create(convId, 'user', 'First');
    jest.setSystemTime(t0 + 1000);
    msgRepo.create(convId, 'assistant', 'Second');
    jest.setSystemTime(t0 + 2000);
    msgRepo.create(convId, 'user', 'Third');
    jest.useRealTimers();

    const messages = msgRepo.findByConversation(convId);
    expect(messages.map(m => m.content)).toEqual(['First', 'Second', 'Third']);
  });

  it('returns messages with correct role mapping', () => {
    msgRepo.create(convId, 'user', 'Question');
    msgRepo.create(convId, 'assistant', 'Answer');

    const messages = msgRepo.findByConversation(convId);
    expect(messages[0]?.role).toBe('user');
    expect(messages[1]?.role).toBe('assistant');
  });
});

// ─── deleteByConversation ─────────────────────────────────────────────────────

describe('deleteByConversation', () => {
  it('removes all messages for the conversation', () => {
    msgRepo.create(convId, 'user', 'A');
    msgRepo.create(convId, 'assistant', 'B');
    msgRepo.deleteByConversation(convId);
    expect(msgRepo.findByConversation(convId)).toEqual([]);
  });

  it('does not affect messages in other conversations', () => {
    const other = convRepo.create('Other').id;
    msgRepo.create(convId, 'user', 'Mine');
    msgRepo.create(other, 'user', 'Theirs');

    msgRepo.deleteByConversation(convId);

    expect(msgRepo.findByConversation(convId)).toEqual([]);
    expect(msgRepo.findByConversation(other)).toHaveLength(1);
  });

  it('is a no-op for a conversation with no messages', () => {
    expect(() => msgRepo.deleteByConversation(convId)).not.toThrow();
  });
});

// ─── CASCADE delete ───────────────────────────────────────────────────────────

describe('foreign key CASCADE', () => {
  it('deletes messages automatically when the parent conversation is deleted', () => {
    msgRepo.create(convId, 'user', 'Orphan-to-be');
    convRepo.delete(convId);
    expect(msgRepo.findByConversation(convId)).toEqual([]);
  });
});
