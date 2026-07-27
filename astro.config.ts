import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.theophile.blog',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: 'github-light' },
    processor: unified({
      remarkRehype: {
        footnoteLabel: 'Références',
        footnoteBackLabel: (referenceIndex: number, rereferenceIndex: number) =>
          `Retour à la référence ${referenceIndex + 1}${rereferenceIndex > 1 ? `-${rereferenceIndex}` : ''}`,
      },
    }),
  },
});
