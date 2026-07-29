import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const postCard = readFileSync('src/components/PostCard.astro', 'utf8');
const postImage = readFileSync('src/components/PostImage.astro', 'utf8');
const postPage = readFileSync('src/pages/[year]/[month]/[slug].astro', 'utf8');
const homePage = readFileSync('src/pages/index.astro', 'utf8');
const styles = readFileSync('src/styles/global.css', 'utf8');

describe('featured post images', () => {
  it('renders featured media in post cards and article pages', () => {
    expect(postCard).toContain('image && <PostImage');
    expect(homePage).toContain('image={featuredPost.data.featuredMedia}');
    expect(postPage).toContain('post.data.featuredMedia &&');
    expect(postPage).toContain('variant="article"');
  });

  it('loads card images lazily and gives article images priority', () => {
    expect(postImage).toContain("loading = 'lazy'");
    expect(postImage).toContain("loading === 'eager' ? 'high' : 'auto'");
    expect(postPage).toContain('loading="eager"');
  });

  it('uses a restrained theme-colored image treatment', () => {
    expect(styles).toContain('.post-image::after');
    expect(styles).toContain('mix-blend-mode: multiply');
    expect(styles).toContain(
      'filter: saturate(0.58) sepia(0.12) contrast(0.92)',
    );
  });
});
