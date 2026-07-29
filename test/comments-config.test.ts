import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { site } from '../src/data/site';

const comments = readFileSync('src/components/Comments.astro', 'utf8');

describe('comment form configuration', () => {
  it('includes the production Turnstile site key in static builds', () => {
    expect(site.turnstileSiteKey).toMatch(/^0x[\w-]+$/);
    expect(comments).toContain('data-site-key={site.turnstileSiteKey}');
    expect(comments).not.toContain('import.meta.env.PUBLIC_TURNSTILE_SITE_KEY');
  });
});
