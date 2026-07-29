import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/layouts/Layout.astro', 'utf8');
const homePage = readFileSync('src/pages/index.astro', 'utf8');
const blogPage = readFileSync('src/pages/blog/index.astro', 'utf8');
const aboutPage = readFileSync(
  'src/content/pages/2015-10-08-a-propos.md',
  'utf8',
);
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

  it('turns the footer into a useful editorial colophon', () => {
    expect(layout).toContain('class="footer-masthead"');
    expect(layout).toContain('Continuer la réflexion.');
    expect(layout).toContain('aria-label="Explorer Théophile"');
    expect(layout).toContain('aria-label="À propos de Théophile"');
    expect(layout).toContain('href="#top"');
    expect(layout).toContain('<body id="top">');
    expect(styles).toContain("content: 'Θ';");
    expect(styles).toContain('.footer-colophon');
  });

  it('uses an asymmetric lead-story composition on the homepage', () => {
    expect(homePage).toContain('class="editorial-grid"');
    expect(homePage).toContain('variant="featured"');
    expect(homePage).toContain('class="editorial-index"');
  });

  it('keeps the homepage glyph decorative without narrowing mobile content', () => {
    expect(styles).toMatch(
      /\.home-hero\s*{[^}]*grid-template-columns: 3\.5rem minmax\(0, 1fr\)/,
    );
    expect(styles).toMatch(/\.hero-glyph\s*{[^}]*position: absolute/);
    expect(styles).toMatch(
      /@media \(max-width: 46rem\)[\s\S]*?\.hero-glyph\s*{\s*display: none;/,
    );
  });

  it('extends mobile page separators to the viewport edge outside articles', () => {
    expect(styles).toContain('.page-shell > .hero');
    expect(styles).toContain('.page-shell > .home-articles');
    expect(styles).toContain('.page-shell > .post-grid');
    expect(styles).toContain('width: calc(100% + 2rem);');
    expect(styles).toContain('.home-articles > .section-heading');
    expect(styles).toContain('.home-articles .editorial-index');
  });

  it('uses standard cards throughout the blog listing', () => {
    expect(blogPage).not.toContain('variant="featured"');
    expect(blogPage).not.toContain("? 'featured' : 'standard'");
  });

  it('provides a reduced-motion treatment for the coordinated reveal', () => {
    expect(homePage).toContain('data-reveal');
    expect(styles).toContain('@keyframes folio-reveal');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('shows the available author portrait on the about page', () => {
    const portraitUrl =
      'https://media.theophile.blog/2020/04/27971581_10160143080155245_3911814555783645094_n.jpg';

    expect(aboutPage).toContain(
      `[![Portrait de Sonny Perron-Nault](${portraitUrl})](${portraitUrl})`,
    );
    expect(aboutPage).toContain('{.align-right width=300}');
    expect(aboutPage).not.toContain(
      '27971581_10160143080155245_3911814555783645094_n-300x300.jpg',
    );
    expect(aboutPage).not.toMatch(/<img|<a\s/i);
    expect(styles).toContain('.article-body img.align-right');
  });
});
