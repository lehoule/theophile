import { defineCollection } from 'astro:content';
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

const posts = defineCollection({ type: 'content', schema: contentSchema });
const pages = defineCollection({ type: 'content', schema: contentSchema });

export const collections = { posts, pages };
