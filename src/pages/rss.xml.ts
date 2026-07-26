import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { postHref } from '../data/urls';

const xmlEntities: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
};
const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => xmlEntities[char] || char);

export const GET: APIRoute = async ({ site: astroSite }) => {
  const feedOrigin = astroSite || new URL(site.origin);
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf())
    .slice(0, 50);
  const items = posts
    .map(
      (post) =>
        `<item><title>${escapeXml(post.data.title)}</title><link>${new URL(postHref(post.data.publishedAt, post.data.slug), site.origin)}</link><guid>${new URL(postHref(post.data.publishedAt, post.data.slug), site.origin)}</guid><pubDate>${post.data.publishedAt.toUTCString()}</pubDate><description>${escapeXml(post.data.excerpt || '')}</description></item>`,
    )
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(site.title)}</title><link>${feedOrigin}</link><description>${escapeXml(site.description)}</description>${items}</channel></rss>`;
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
};
