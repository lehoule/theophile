import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const searchPage = readFileSync('src/pages/recherche.astro', 'utf8');

describe('search page scripts', () => {
  it('loads its initializer as a same-origin Astro script for the worker CSP', () => {
    expect(searchPage).toContain(
      '<script is:inline src="/search.js"></script>',
    );
  });
});
