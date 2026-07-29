import { describe, expect, it, vi } from 'vitest';
import { deleteComment, editReply } from '../worker/comment-moderation';

describe('comment deletion', () => {
  it('soft-deletes an administrator reply without breaking its moderation history', async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const batch = vi.fn(async () => []);
    const db = {
      prepare(sql: string) {
        const statement = { sql, values: [] as unknown[] };
        statements.push(statement);
        return {
          bind(...values: unknown[]) {
            statement.values = values;
            return this;
          },
        };
      },
      batch,
    } as unknown as D1Database;

    const response = await deleteComment(
      db,
      'reply-id',
      'admin@example.com',
      '2026-07-29T12:00:00.000Z',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 'reply-id',
      status: 'deleted',
    });
    expect(batch).toHaveBeenCalledOnce();
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain("SET status = 'deleted'");
    expect(statements[0].sql).not.toMatch(/^DELETE FROM comments/);
    expect(statements[0].values).toEqual([
      '2026-07-29T12:00:00.000Z',
      'reply-id',
    ]);
    expect(statements[1].sql).toContain('INSERT INTO moderation_events');
    expect(statements[1].values.slice(1)).toEqual([
      'reply-id',
      'delete',
      'admin@example.com',
      '2026-07-29T12:00:00.000Z',
    ]);
  });

  it('updates an administrator reply and records the edit', async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const batch = vi.fn(async () => []);
    const db = {
      prepare(sql: string) {
        const statement = { sql, values: [] as unknown[] };
        statements.push(statement);
        return {
          bind(...values: unknown[]) {
            statement.values = values;
            return this;
          },
        };
      },
      batch,
    } as unknown as D1Database;

    const response = await editReply(
      db,
      'reply-id',
      'Réponse corrigée',
      'admin@example.com',
      '2026-07-29T12:05:00.000Z',
    );

    await expect(response.json()).resolves.toEqual({
      id: 'reply-id',
      status: 'approved',
      body: 'Réponse corrigée',
    });
    expect(batch).toHaveBeenCalledOnce();
    expect(statements[0].sql).toContain('UPDATE comments SET body = ?');
    expect(statements[0].values).toEqual([
      'Réponse corrigée',
      '2026-07-29T12:05:00.000Z',
      'reply-id',
    ]);
    expect(statements[1].values.slice(1)).toEqual([
      'reply-id',
      'edit',
      'admin@example.com',
      '2026-07-29T12:05:00.000Z',
    ]);
  });
});
