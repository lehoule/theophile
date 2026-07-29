import { describe, expect, it } from 'vitest';
import {
  featuredMediaByAttachmentId,
  featuredMediaFor,
  rewriteInternalSiteLinks,
} from '../scripts/import-wordpress.mjs';

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

describe('WordPress featured media import', () => {
  it('resolves a post thumbnail to the migrated media host', () => {
    const attachment = {
      'wp:post_type': 'attachment',
      'wp:post_id': 42,
      'wp:attachment_url':
        'https://www.theophile.xyz/wp-content/uploads/2025/09/ciel.jpg',
    };
    const post = {
      'wp:postmeta': [{ 'wp:meta_key': '_thumbnail_id', 'wp:meta_value': 42 }],
    };

    const media = featuredMediaByAttachmentId([attachment]);

    expect(featuredMediaFor(post, media)).toBe(
      'https://media.theophile.blog/2025/09/ciel.jpg',
    );
  });

  it('leaves posts without a thumbnail without featured media', () => {
    expect(featuredMediaFor({}, new Map())).toBeUndefined();
  });
});
