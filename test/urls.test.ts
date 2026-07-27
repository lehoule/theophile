import { describe, expect, it } from 'vitest';
import { categoryHref, postHref, slugify } from '../src/data/urls';
import { mediaUrl } from '../src/data/media';

describe('site URLs', () => {
  it('builds a UTC post URL with a zero-padded month', () => {
    expect(postHref(new Date('2026-01-05T23:00:00-05:00'), 'mon-article')).toBe(
      '/2026/01/mon-article/',
    );
  });

  it('slugifies accents, whitespace, and punctuation', () => {
    expect(slugify('  Théologie & liberté — 2  ')).toBe('theologie-liberte-2');
    expect(categoryHref('Foi chrétienne')).toBe('/category/foi-chretienne/');
  });

  it('encodes each media path segment and optional image width', () => {
    expect(mediaUrl('audio/Mon fichier.mp3')).toBe(
      'https://media.theophile.blog/audio/Mon%20fichier.mp3',
    );
    expect(mediaUrl('images/été photo.jpg', 800)).toBe(
      'https://media.theophile.blog/cdn-cgi/image/width=800,format=auto/images/%C3%A9t%C3%A9%20photo.jpg',
    );
  });
});
