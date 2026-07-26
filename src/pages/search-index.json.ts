import { getCollection } from 'astro:content';
import { postHref } from '../data/urls';

export async function GET() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const entries = posts.map((post) => ({
    title: post.data.title,
    url: postHref(post.data.publishedAt, post.data.slug),
    excerpt: post.data.excerpt || '',
    text: `${post.data.title}\n${post.data.excerpt || ''}\n${post.body || ''}`,
  }));
  return new Response(JSON.stringify(entries), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
