import { describe, expect, it } from 'vitest';
import { parseCursor, validateCommentInput } from '../worker/lib';

describe('comment validation', () => {
  it('accepts plain text with an optional email', () => {
    expect(validateCommentInput({ name: 'Sonny', email: 'sonny@example.com', body: 'Bonjour.' })?.name).toBe('Sonny');
  });
  it('rejects unsafe markup and oversized links', () => {
    expect(validateCommentInput({ name: 'A', body: '<script>alert(1)</script>' })).toBeNull();
    expect(validateCommentInput({ name: 'A valid name', body: 'http://a.test http://b.test http://c.test http://d.test' })).toBeNull();
  });
  it('rejects short names and bodies', () => {
    expect(validateCommentInput({ name: 'A', body: 'x' })).toBeNull();
  });
  it('handles malformed cursors safely', () => {
    expect(parseCursor('not-base64')).toBeNull();
  });
});
