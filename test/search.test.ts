import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const searchPage = readFileSync('src/pages/recherche.astro', 'utf8');
const searchScript = readFileSync('public/search.js', 'utf8');
const headers = readFileSync('public/_headers', 'utf8');

describe('search page scripts', () => {
  it('loads its initializer as a same-origin Astro script for the worker CSP', () => {
    expect(searchPage).toContain(
      '<script is:inline src="/search.js"></script>',
    );
    expect(searchPage).not.toMatch(/<script is:inline>\s/);
    expect(searchScript).toContain('window.PagefindUI');
    expect(headers).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(headers).not.toContain("'unsafe-eval'");
  });
});
