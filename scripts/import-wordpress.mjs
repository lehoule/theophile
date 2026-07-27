import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import TurndownService from 'turndown';

export function rewriteInternalSiteLinks(value) {
  return value.replace(
    /https?:\/\/(?:www\.)?theophile\.xyz/gi,
    (match, offset, source) =>
      source[offset + match.length] === '/' ? '' : '/',
  );
}

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  isArray: (name) =>
    name === 'item' || name === 'category' || name === 'wp:postmeta',
});
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
});
turndown.addRule('wordpressComments', {
  filter: (node) => node.nodeType === 8,
  replacement: () => '',
});
const value = (entry) =>
  typeof entry === 'object' && entry !== null && '#text' in entry
    ? entry['#text']
    : String(entry ?? '');
const yaml = (value) => JSON.stringify(value);
const dateFor = (item) => {
  const raw =
    value(item['wp:post_date_gmt']) ||
    value(item['wp:post_date']) ||
    value(item.pubDate);
  const candidate =
    raw && !raw.startsWith('0000-00-00')
      ? new Date(raw)
      : new Date(value(item.pubDate));
  return Number.isFinite(candidate.valueOf())
    ? candidate
    : new Date(value(item.pubDate));
};
const taxonomies = (item) =>
  (Array.isArray(item.category)
    ? item.category
    : item.category
      ? [item.category]
      : []
  )
    .map((category) => ({
      name: typeof category === 'object' ? value(category) : String(category),
      domain:
        typeof category === 'object' ? String(category['@_domain'] || '') : '',
    }))
    .filter((category) => category.name);
const categories = (item) =>
  taxonomies(item)
    .filter((category) => category.domain !== 'post_tag')
    .map((category) => category.name);
const tags = (item) =>
  taxonomies(item)
    .filter((category) => category.domain === 'post_tag')
    .map((category) => category.name);
const markdownFootnotes = (markdown) => {
  const references = [];
  const body = markdown.replace(/\(\(([\s\S]*?)\)\)/g, (_, reference) => {
    references.push(reference.trim());
    return `[^${references.length}]`;
  });

  if (!references.length) return body;
  const definitions = references
    .map((reference, index) => {
      const lines = reference.split('\n');
      return [
        `[^${index + 1}]: ${lines[0]}`,
        ...lines.slice(1).map((line) => `    ${line}`),
      ].join('\n');
    })
    .join('\n\n');
  return `${body.trim()}\n\n${definitions}`;
};
function writeEntry(item, directory) {
  const id = Number(value(item['wp:post_id']));
  const title = value(item.title).trim();
  const slug = value(item['wp:post_name']).trim() || `wordpress-${id}`;
  const date = dateFor(item);
  if (!Number.isFinite(date.valueOf()))
    throw new Error(`Invalid date for WordPress item ${id}`);
  const body = markdownFootnotes(
    rewriteInternalSiteLinks(
      turndown
        .turndown(value(item['content:encoded']))
        .replace(
          /https?:\/\/(?:www\.)?theophile\.xyz\/wp-content\/uploads\//gi,
          'https://media.theophile.blog/',
        )
        .replace(/\/wp-content\/uploads\//gi, 'https://media.theophile.blog/'),
    ),
  );
  const modified = new Date(
    value(item['wp:post_modified_gmt']) ||
      value(item['wp:post_modified']) ||
      date,
  );
  const excerpt = value(item['excerpt:encoded']).trim();
  const frontmatter = [
    '---',
    `title: ${yaml(title)}`,
    `slug: ${yaml(slug)}`,
    `publishedAt: ${date.toISOString()}`,
    Number.isFinite(modified.valueOf())
      ? `updatedAt: ${modified.toISOString()}`
      : '',
    excerpt ? `excerpt: ${yaml(excerpt)}` : '',
    `author: ${yaml(value(item['dc:creator']) || 'Théophile')}`,
    `categories: ${yaml(categories(item))}`,
    `tags: ${yaml(tags(item))}`,
    `commentId: ${yaml(String(id))}`,
    `legacyWordPressId: ${id}`,
    'draft: false',
    '---',
    '',
  ]
    .filter(Boolean)
    .join('\n');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, `${date.toISOString().slice(0, 10)}-${slug}.md`),
    `${frontmatter}\n${body.trim()}\n`,
  );
  const sourceBody = value(item['content:encoded']);
  const shortcodes = [
    ...new Set(sourceBody.match(/\[[a-z][a-z0-9_-]*(?:\s[^\]]*)?\]/gi) || []),
  ];
  const mediaReferences = [
    ...new Set(
      sourceBody.match(
        /(?:https?:\/\/[^\s"')]+)?\/wp-content\/uploads\/[^\s"')]+/gi,
      ) || [],
    ),
  ];
  return {
    id,
    title,
    slug,
    date: date.toISOString(),
    categories: categories(item),
    tags: tags(item),
    shortcodes,
    mediaReferences,
  };
}
function main(input) {
  if (!input)
    throw new Error(
      'Usage: node scripts/import-wordpress.mjs path/to/wordpress.xml',
    );

  const document = parser.parse(fs.readFileSync(input, 'utf8'));
  const items = document?.rss?.channel?.item || [];
  const posts = items.filter(
    (item) =>
      item['wp:post_type'] === 'post' && item['wp:status'] === 'publish',
  );
  const pages = items.filter(
    (item) =>
      item['wp:post_type'] === 'page' && item['wp:status'] === 'publish',
  );
  const importedPosts = posts.map((item) =>
    writeEntry(item, 'src/content/posts'),
  );
  const importedPages = pages.map((item) =>
    writeEntry(item, 'src/content/pages'),
  );
  fs.mkdirSync('migration', { recursive: true });
  fs.writeFileSync(
    'migration/content-report.json',
    JSON.stringify(
      {
        source: input,
        posts: importedPosts.length,
        pages: importedPages.length,
        categories: [
          ...new Set(importedPosts.flatMap((post) => post.categories)),
        ].length,
        tags: [...new Set(importedPosts.flatMap((post) => post.tags))].length,
        unknownShortcodes: [
          ...new Set(
            [...importedPosts, ...importedPages].flatMap(
              (entry) => entry.shortcodes,
            ),
          ),
        ],
        mediaReferences: [
          ...new Set(
            [...importedPosts, ...importedPages].flatMap(
              (entry) => entry.mediaReferences,
            ),
          ),
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    `Imported ${importedPosts.length} posts and ${importedPages.length} pages. Review migration/content-report.json before publishing.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2]);
