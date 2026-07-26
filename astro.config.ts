import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.theophile.xyz',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: 'github-light' },
    remarkRehype: {
      footnoteLabel: 'Références',
      footnoteBackLabel: (referenceIndex: number, rereferenceIndex: number) => `Retour à la référence ${referenceIndex + 1}${rereferenceIndex > 1 ? `-${rereferenceIndex}` : ''}`,
    },
  },
});
