import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/layouts/Layout.astro', 'utf8');
const homePage = readFileSync('src/pages/index.astro', 'utf8');
const styles = readFileSync('src/styles/global.css', 'utf8');
const fontStyles = readFileSync('src/styles/fonts.css', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
};

describe('editorial design system', () => {
  it('self-hosts the exact-version editorial typefaces', () => {
    expect(packageJson.dependencies['@fontsource-variable/literata']).toBe(
      '5.3.0',
    );
    expect(packageJson.dependencies['@fontsource-variable/azeret-mono']).toBe(
      '5.3.0',
    );
    expect(layout).toContain('literata-latin-standard-normal.woff2?url');
    expect(layout).toContain('azeret-mono-latin-wght-normal.woff2?url');
    expect(layout.match(/rel="preload"/g)).toHaveLength(4);
    expect(fontStyles.match(/font-display: optional/g)).toHaveLength(4);
  });

  it('keeps the masthead navigable and identifies the current section', () => {
    expect(layout).toContain('aria-label="Théophile — accueil"');
    expect(layout).toContain('class="brand-symbol"');
    expect(layout).toContain("aria-current={isCurrent(item.href) ? 'page'");
    expect(styles).toContain(".site-header nav a[aria-current='page']::after");
    expect(styles).not.toMatch(/\.brand:hover \.brand-mark\s*{/);
    expect(styles).not.toMatch(/\.brand-mark,[\s\S]*?border-radius:\s*50%/);
  });

  it('uses an asymmetric lead-story composition on the homepage', () => {
    expect(homePage).toContain('class="editorial-grid"');
    expect(homePage).toContain('variant="featured"');
    expect(homePage).toContain('class="editorial-index"');
  });

  it('provides a reduced-motion treatment for the coordinated reveal', () => {
    expect(homePage).toContain('data-reveal');
    expect(styles).toContain('@keyframes folio-reveal');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
