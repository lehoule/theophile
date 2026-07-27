import { describe, expect, it } from 'vitest';
import { isPublishableMediaPath } from '../scripts/inventory-media.mjs';

describe('media inventory paths', () => {
  it('keeps dated WordPress uploads', () => {
    expect(isPublishableMediaPath('2018/01/article-image.jpg')).toBe(true);
  });

  it('filters top-level plugin uploads', () => {
    expect(isPublishableMediaPath('wpconsent/index.html')).toBe(false);
    expect(isPublishableMediaPath('wp-statistics/cache.json')).toBe(false);
    expect(isPublishableMediaPath('siteorigin-widgets/icon.svg')).toBe(false);
  });

  it('filters plugin uploads nested outside the YYYY/MM layout', () => {
    expect(isPublishableMediaPath('2024/wpconsent/cache.json')).toBe(false);
    expect(isPublishableMediaPath('2024/13/not-a-month.txt')).toBe(false);
  });
});
