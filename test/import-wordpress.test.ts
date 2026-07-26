import { describe, expect, it } from 'vitest';
import { rewriteInternalSiteLinks } from '../scripts/import-wordpress.mjs';

describe('WordPress content URL rewriting', () => {
  it('converts both site hostnames and protocols to local paths', () => {
    const content =
      '[article](http://www.theophile.xyz/2016/01/le-saut-avec-dieu/) ' +
      '[page](https://theophile.xyz/a-propos/)';

    expect(rewriteInternalSiteLinks(content)).toBe(
      '[article](/2016/01/le-saut-avec-dieu/) [page](/a-propos/)',
    );
    expect(rewriteInternalSiteLinks('https://www.theophile.xyz')).toBe('/');
  });

  it('keeps media URLs on the media host', () => {
    const content =
      'https://media.theophile.xyz/2016/01/image.jpg and https://other.example/';

    expect(rewriteInternalSiteLinks(content)).toBe(content);
  });
});
