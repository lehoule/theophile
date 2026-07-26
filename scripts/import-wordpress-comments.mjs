import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const input = process.argv[2];
if (!input)
  throw new Error(
    'Usage: node scripts/import-wordpress-comments.mjs path/to/wordpress.xml',
  );
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  isArray: (name) => name === 'item' || name === 'wp:comment',
});
const parsed = parser.parse(fs.readFileSync(input, 'utf8'));
const items = parsed?.rss?.channel?.item || [];
const sql = [];
let approved = 0;
let orphanParents = 0;
const escape = (value) => `'${String(value ?? '').replaceAll("'", "''")}'`;
const value = (entry) =>
  typeof entry === 'object' && entry !== null && '#text' in entry
    ? entry['#text']
    : String(entry ?? '');
const safeText = (html) =>
  String(html ?? '')
    .replace(
      /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      '$2 ($1)',
    )
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
for (const item of items) {
  const postId = Number(value(item['wp:post_id']));
  const comments = Array.isArray(item['wp:comment'])
    ? item['wp:comment']
    : item['wp:comment']
      ? [item['wp:comment']]
      : [];
  const ids = new Map(
    comments.map((comment) => [
      Number(value(comment['wp:comment_id'])),
      `wp-comment-${Number(value(comment['wp:comment_id']))}`,
    ]),
  );
  for (const comment of comments) {
    if (value(comment['wp:comment_approved']) !== '1') continue;
    const wordpressId = Number(value(comment['wp:comment_id']));
    const parent = Number(value(comment['wp:comment_parent']));
    const id = ids.get(wordpressId);
    const parentId = parent ? ids.get(parent) : undefined;
    if (parent && !parentId) orphanParents += 1;
    if (!id) continue;
    const createdDate = new Date(
      value(comment['wp:comment_date_gmt']) ||
        value(comment['wp:comment_date']),
    );
    if (!Number.isFinite(createdDate.valueOf())) continue;
    const created = createdDate.toISOString();
    const body = safeText(comment['wp:comment_content']);
    const email = value(comment['wp:comment_author_email']).trim();
    sql.push(
      `INSERT OR IGNORE INTO comments (id, post_id, parent_id, wordpress_id, author_name, author_email, body, status, source, created_at, updated_at) VALUES (${escape(id)}, ${escape(String(postId))}, ${parentId ? escape(parentId) : 'NULL'}, ${wordpressId}, ${escape(value(comment['wp:comment_author']))}, ${email ? escape(email) : 'NULL'}, ${escape(body)}, 'approved', 'wordpress', ${escape(created)}, ${escape(created)});`,
    );
    approved += 1;
  }
}
fs.mkdirSync('backups', { recursive: true });
fs.writeFileSync(
  path.resolve('backups/comment-import.sql'),
  `BEGIN TRANSACTION;\n${sql.join('\n')}\nCOMMIT;\n`,
);
fs.writeFileSync(
  path.resolve('migration/comment-report.json'),
  `${JSON.stringify({ source: input, approved, orphanParents }, null, 2)}\n`,
);
console.log(
  `Generated ${sql.length} approved comment import statements in backups/comment-import.sql. Review migration/comment-report.json.`,
);
