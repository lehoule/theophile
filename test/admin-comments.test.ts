import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const adminComments = readFileSync('src/pages/admin/comments.astro', 'utf8');

describe('administrator replies', () => {
  it('renders edit and delete controls below the parent comment', () => {
    expect(adminComments).toContain('renderReplies(item.replies)');
    expect(adminComments).toContain('data-action="edit"');
    expect(adminComments).toContain('data-action="delete"');
  });

  it('sends edited replies to the dedicated endpoint', () => {
    expect(adminComments).toContain('fetch(`/api/admin/comments/${id}/reply`');
    expect(adminComments).toContain("method: 'PATCH'");
    expect(adminComments).toContain("window.prompt('Modifier la réponse'");
  });
});
