import { describe, expect, it } from 'vitest';
import {
  buildCommentRows,
  renderCommentImport,
} from '../scripts/import-wordpress-comments.mjs';

const comment = (id: number, parent: number, approved = '1') => ({
  'wp:comment_id': String(id),
  'wp:comment_parent': String(parent),
  'wp:comment_approved': approved,
  'wp:comment_date_gmt': '2026-07-25 12:00:00',
  'wp:comment_author': `Author ${id}`,
  'wp:comment_author_email': '',
  'wp:comment_content': `Comment ${id}`,
});

describe('WordPress comment import ordering', () => {
  it('renders D1-compatible SQL without manual transaction statements', () => {
    const result = buildCommentRows([
      {
        'wp:post_id': '42',
        'wp:comment': [comment(1, 0)],
      },
    ]);

    const sql = renderCommentImport(result.rows);

    expect(sql).not.toContain('BEGIN TRANSACTION');
    expect(sql).not.toContain('COMMIT');
    expect(sql).toContain('INSERT OR IGNORE INTO comments');
  });

  it('writes approved parents before their replies', () => {
    const result = buildCommentRows([
      {
        'wp:post_id': '42',
        'wp:comment': [comment(2, 1), comment(1, 0)],
      },
    ]);

    expect(result.rows[0]).toContain("'wp-comment-1'");
    expect(result.rows[1]).toContain("'wp-comment-2'");
    expect(result.rows[1]).toContain("'wp-comment-1'");
    expect(result.orphanParents).toBe(0);
  });

  it('removes references to unapproved parents', () => {
    const result = buildCommentRows([
      {
        'wp:post_id': '42',
        'wp:comment': [comment(2, 1), comment(1, 0, '0')],
      },
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toContain("'wp-comment-2', '42', NULL");
    expect(result.orphanParents).toBe(1);
  });

  it('decodes HTML entities in imported comment text', () => {
    const result = buildCommentRows([
      {
        'wp:post_id': '42',
        'wp:comment': [
          {
            ...comment(1, 0),
            'wp:comment_content':
              'C&#039;est bon&nbsp;! &amp; merci. &lt;important&gt;',
          },
        ],
      },
    ]);

    expect(result.rows[0]).toContain("'C''est bon ! & merci. <important>'");
  });
});
