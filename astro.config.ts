import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkImageAttributes from './src/plugins/remark-image-attributes';

export default defineConfig({
  site: 'https://www.theophile.blog',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: 'github-light' },
    processor: unified({
      remarkPlugins: [remarkImageAttributes],
      remarkRehype: {
        footnoteLabel: 'Références',
        footnoteBackLabel: (referenceIndex: number, rereferenceIndex: number) =>
          `Retour à la référence ${referenceIndex + 1}${rereferenceIndex > 1 ? `-${rereferenceIndex}` : ''}`,
      },
    }),
  },
});
