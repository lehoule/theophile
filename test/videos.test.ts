import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { youtubeEmbedUrl } from '../src/data/youtube';

const videosMarkdown = readFileSync(
  new URL('../src/content/pages/2017-10-03-videos.md', import.meta.url),
  'utf8',
);

describe('videos markdown', () => {
  it('keeps YouTube links and PDFs editable in Markdown', () => {
    const youtubeLinks = [
      ...videosMarkdown.matchAll(/\]\((https:\/\/youtu\.be\/[^)]+)\)/g),
    ].map((match) => match[1]);
    const pdfLinks = videosMarkdown.match(/\.pdf\)/g) || [];

    expect(youtubeLinks).toHaveLength(8);
    expect(youtubeLinks.map(youtubeEmbedUrl)).toHaveLength(8);
    expect(pdfLinks).toHaveLength(5);
  });

  it('keeps all related article links from the original page', () => {
    const relatedArticlePaths = [
      '/2017/05/repenser-lenfer-approche-epistemologique/',
      '/2017/06/repenser-lenfer-introduction-conditionalisme/',
      '/2017/06/repenser-lenfer-le-conditionalisme-un-demotivateur-pour-levangile/',
      '/2017/09/repenser-lenfer-lenseignement-peres-apostoliques-partie-1/',
      '/2018/01/repenser-lenfer-lenseignement-peres-apostoliques-partie-2/',
      '/2018/02/repenser-lenfer-intuitions-theologiques/',
      '/2018/02/repenser-lenfer-passages-bibliques-pour-les-tourments-eternels/',
      '/2018/03/repenser-lenfer-judith-1617-un-texte-incertain/',
      '/2011/05/la-bible-mythe-ou-histoire/',
      '/2012/12/raisons-de-croire-en-la-naissance-miraculeuse-de-jesus/',
      '/2017/04/comment-interpreter-la-genese/',
    ];

    for (const path of relatedArticlePaths) {
      expect(videosMarkdown).toContain(`](${path})`);
    }
  });

  it('converts supported YouTube URLs to embed URLs', () => {
    expect(youtubeEmbedUrl('https://youtu.be/NeFLVft6izs')).toBe(
      'https://www.youtube.com/embed/NeFLVft6izs',
    );
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=GlQJCFbCckY')).toBe(
      'https://www.youtube.com/embed/GlQJCFbCckY',
    );
    expect(() => youtubeEmbedUrl('https://example.com/video')).toThrow(
      'Invalid YouTube URL',
    );
  });
});
