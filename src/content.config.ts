import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const contentSchema = z.object({
  title: z.string(),
  slug: z.string(),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  excerpt: z.string().optional(),
  author: z.string().default('Théophile'),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  featuredMedia: z.string().optional(),
  commentId: z.string().optional(),
  legacyWordPressId: z.number().int().optional(),
  draft: z.boolean().default(false),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: contentSchema,
});
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: contentSchema,
});

export const collections = { posts, pages };
