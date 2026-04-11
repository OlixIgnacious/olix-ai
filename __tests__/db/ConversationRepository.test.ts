/**
 * Unit tests for ConversationRepository.
 *
 * Uses a real in-memory SQLite database (better-sqlite3) via makeTestHandle(),
 * so every assertion exercises actual SQL — not mocked return values.
 */

import {ConversationRepository} from '../../src/db/ConversationRepository';
import {makeTestHandle} from './helpers';
import type {DBHandle} from '../../src/db/types';

// ─── Setup ────────────────────────────────────────────────────────────────────

let handle: DBHandle;
let repo: ConversationRepository;

beforeEach(() => {
  handle = makeTestHandle();
  repo = new ConversationRepository(handle);
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('create', () => {
  it('returns a conversation with the given title', () => {
    const conv = repo.create('My first chat');
    expect(conv.title).toBe('My first chat');
  });

  it('assigns a UUID id', () => {
    const conv = repo.create('Test');
    expect(conv.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('sets createdAt and updatedAt to the same timestamp', () => {
    const before = Date.now();
    const conv = repo.create('Test');
    const after = Date.now();
    expect(conv.createdAt).toBeGreaterThanOrEqual(before);
    expect(conv.createdAt).toBeLessThanOrEqual(after);
    expect(conv.updatedAt).toBe(conv.createdAt);
  });

  it('persists to the database', () => {
    const conv = repo.create('Persisted');
    const found = repo.findById(conv.id);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Persisted');
  });

  it('each call produces a unique id', () => {
    const a = repo.create('A');
    const b = repo.create('B');
    expect(a.id).not.toBe(b.id);
  });
});

// ─── findAll ──────────────────────────────────────────────────────────────────

describe('findAll', () => {
  it('returns an empty array when no conversations exist', () => {
    expect(repo.findAll()).toEqual([]);
  });

  it('returns all conversations', () => {
    repo.create('Alpha');
    repo.create('Beta');
    expect(repo.findAll()).toHaveLength(2);
  });

  it('orders by updatedAt descending (most recently active first)', () => {
    const first = repo.create('First');
    const second = repo.create('Second');

    // Touch first to move it to the top
    // Ensure the timestamps differ by forcing a slight delay via fake time
    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 1000);
    repo.touch(first.id);
    jest.useRealTimers();

    const all = repo.findAll();
    expect(all[0]?.id).toBe(first.id);
    expect(all[1]?.id).toBe(second.id);
  });
});

// ─── findById ─────────────────────────────────────────────────────────────────

describe('findById', () => {
  it('returns the conversation when it exists', () => {
    const conv = repo.create('Found');
    const found = repo.findById(conv.id);
    expect(found).toMatchObject({id: conv.id, title: 'Found'});
  });

  it('returns null for an unknown id', () => {
    expect(repo.findById('non-existent-id')).toBeNull();
  });
});

// ─── updateTitle ──────────────────────────────────────────────────────────────

describe('updateTitle', () => {
  it('changes the title', () => {
    const conv = repo.create('Old title');
    repo.updateTitle(conv.id, 'New title');
    expect(repo.findById(conv.id)?.title).toBe('New title');
  });

  it('bumps updatedAt', () => {
    const conv = repo.create('Title');
    jest.useFakeTimers();
    jest.setSystemTime(conv.createdAt + 5000);
    repo.updateTitle(conv.id, 'Renamed');
    jest.useRealTimers();

    const updated = repo.findById(conv.id);
    expect(updated?.updatedAt).toBeGreaterThan(conv.updatedAt);
  });

  it('is a no-op for an unknown id', () => {
    // Should not throw
    expect(() => repo.updateTitle('ghost', 'Whatever')).not.toThrow();
  });
});

// ─── touch ────────────────────────────────────────────────────────────────────

describe('touch', () => {
  it('moves the conversation to the top of findAll', () => {
    const older = repo.create('Older');

    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 1000);
    const newer = repo.create('Newer');
    jest.setSystemTime(Date.now() + 1000);
    repo.touch(older.id);
    jest.useRealTimers();

    expect(repo.findAll()[0]?.id).toBe(older.id);
    expect(repo.findAll()[1]?.id).toBe(newer.id);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('delete', () => {
  it('removes the conversation', () => {
    const conv = repo.create('Gone');
    repo.delete(conv.id);
    expect(repo.findById(conv.id)).toBeNull();
    expect(repo.findAll()).toHaveLength(0);
  });

  it('is a no-op for an unknown id', () => {
    expect(() => repo.delete('ghost')).not.toThrow();
  });
});
