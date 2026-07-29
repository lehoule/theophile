import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isBrowserLoopback } from '../src/data/local-development';
import { site } from '../src/data/site';

const comments = readFileSync('src/components/Comments.astro', 'utf8');

describe('comment form configuration', () => {
  it('includes the production Turnstile site key in static builds', () => {
    expect(site.turnstileSiteKey).toMatch(/^0x[\w-]+$/);
    expect(comments).toContain('data-site-key={site.turnstileSiteKey}');
    expect(comments).not.toContain('import.meta.env.PUBLIC_TURNSTILE_SITE_KEY');
  });

  it('does not submit comments before Turnstile succeeds', () => {
    expect(comments).toContain('data-comment-submit type="submit" disabled');
    expect(comments).toContain('if (!localDevelopment && !turnstileToken) {');
    expect(comments).toContain("'error-callback': (code)");
    expect(comments).toContain("'expired-callback': () =>");
    expect(comments).toContain("script.addEventListener('error'");
    expect(comments).toContain(
      'render=explicit&onload=onTheophileTurnstileLoad',
    );
    expect(comments).not.toContain("script.addEventListener('load'");
    expect(comments).not.toContain(
      'window.turnstile = window.turnstile || undefined',
    );
  });

  it.each(['localhost', '127.0.0.1', '::1', '[::1]'])(
    'skips Turnstile only on the browser loopback host %s',
    (hostname) => {
      expect(isBrowserLoopback(hostname)).toBe(true);
    },
  );

  it('keeps Turnstile enabled on the production hostname', () => {
    expect(isBrowserLoopback('theophile.blog')).toBe(false);
    expect(comments).toContain(
      'const localDevelopment = isBrowserLoopback(window.location.hostname)',
    );
    expect(comments).toContain('if (!localDevelopment && !turnstileToken)');
  });
});
