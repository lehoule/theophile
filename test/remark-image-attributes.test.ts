import { describe, expect, it } from 'vitest';
import remarkImageAttributes from '../src/plugins/remark-image-attributes';

describe('Markdown image attributes', () => {
  it('applies alignment and width to a linked image', () => {
    const image = { type: 'image' };
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'link', children: [image] },
            {
              type: 'text',
              value: '{.align-right width=300}Le texte commence ici.',
            },
          ],
        },
      ],
    };

    remarkImageAttributes()(tree);

    expect(image).toMatchObject({
      data: {
        hProperties: { className: ['align-right'], width: 300 },
      },
    });
    expect(tree.children[0].children[1]).toMatchObject({
      type: 'text',
      value: 'Le texte commence ici.',
    });
  });

  it('leaves unsupported or unsafe attributes as text', () => {
    const image = { type: 'image' };
    const attributes = { type: 'text', value: '{.align-right width=9999}' };
    const tree = {
      type: 'root',
      children: [{ type: 'paragraph', children: [image, attributes] }],
    };

    remarkImageAttributes()(tree);

    expect(image).not.toHaveProperty('data');
    expect(attributes.value).toBe('{.align-right width=9999}');
  });
});
