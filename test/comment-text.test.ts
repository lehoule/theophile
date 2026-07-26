import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '../src/data/comment-text';

describe('comment text', () => {
  it('decodes named and numeric HTML entities', () => {
    expect(decodeHtmlEntities('C&#039;est &amp; merci&nbsp;! &#x1F642;')).toBe(
      "C'est & merci ! 🙂",
    );
  });

  it('leaves unknown and invalid entities untouched', () => {
    expect(decodeHtmlEntities('&unknown; &#x110000;')).toBe(
      '&unknown; &#x110000;',
    );
  });
});
