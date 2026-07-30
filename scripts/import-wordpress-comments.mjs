import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  isArray: (name) => name === 'item' || name === 'wp:comment',
});
const escape = (value) => `'${String(value ?? '').replaceAll("'", "''")}'`;
const value = (entry) =>
  typeof entry === 'object' && entry !== null && '#text' in entry
    ? entry['#text']
    : String(entry ?? '');
const decodeHtmlEntities = (text) =>
  String(text ?? '').replace(
    /&(#(?:x[\da-f]+|\d+)|amp|apos|gt|lt|nbsp|quot);/gi,
    (match, entity) => {
      if (entity.toLowerCase().startsWith('#x')) {
        const codePoint = Number.parseInt(entity.slice(2), 16);
        return Number.isInteger(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }
      if (entity.startsWith('#')) {
        const codePoint = Number.parseInt(entity.slice(1), 10);
        return Number.isInteger(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }
      return (
        {
          amp: '&',
          apos: "'",
          gt: '>',
          lt: '<',
          nbsp: ' ',
          quot: '"',
        }[entity.toLowerCase()] || match
      );
    },
  );
const safeText = (html) => {
  const text = decodeHtmlEntities(String(html ?? ''))
    .replace(
      /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      '$2 ($1)',
    )
    .replace(/<[^>]+>/g, '')
    .replace(/[<>]/g, '');
  return text.trim();
};

const orderParentsFirst = (records) => {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();

  const visit = (record) => {
    if (visited.has(record.id)) return;
    if (visiting.has(record.id)) {
      record.parentId = null;
      return;
    }
    visiting.add(record.id);
    if (record.parentId) {
      const parent = recordsById.get(record.parentId);
      if (parent) visit(parent);
    }
    visiting.delete(record.id);
    visited.add(record.id);
    ordered.push(record);
  };

  records.forEach(visit);
  return ordered;
};

export const buildCommentRows = (items) => {
  const rows = [];
  let approved = 0;
  let orphanParents = 0;

  for (const item of items) {
    const postId = Number(value(item['wp:post_id']));
    const comments = Array.isArray(item['wp:comment'])
      ? item['wp:comment']
      : item['wp:comment']
        ? [item['wp:comment']]
        : [];
    const records = [];

    for (const comment of comments) {
      if (value(comment['wp:comment_approved']) !== '1') continue;
      const wordpressId = Number(value(comment['wp:comment_id']));
      const createdDate = new Date(
        value(comment['wp:comment_date_gmt']) ||
          value(comment['wp:comment_date']),
      );
      if (!Number.isFinite(createdDate.valueOf())) continue;
      records.push({
        id: `wp-comment-${wordpressId}`,
        wordpressId,
        parentWordpressId: Number(value(comment['wp:comment_parent'])),
        created: createdDate.toISOString(),
        authorName: value(comment['wp:comment_author']),
        email: value(comment['wp:comment_author_email']).trim(),
        body: safeText(comment['wp:comment_content']),
      });
    }

    const approvedIds = new Map(
      records.map((record) => [record.wordpressId, record.id]),
    );
    records.forEach((record) => {
      record.parentId = record.parentWordpressId
        ? (approvedIds.get(record.parentWordpressId) ?? null)
        : null;
      if (record.parentWordpressId && !record.parentId) orphanParents += 1;
      delete record.parentWordpressId;
    });

    for (const record of orderParentsFirst(records)) {
      rows.push(
        `INSERT OR IGNORE INTO comments (id, post_id, parent_id, wordpress_id, author_name, author_email, body, status, source, created_at, updated_at) VALUES (${escape(record.id)}, ${escape(String(postId))}, ${record.parentId ? escape(record.parentId) : 'NULL'}, ${record.wordpressId}, ${escape(record.authorName)}, ${record.email ? escape(record.email) : 'NULL'}, ${escape(record.body)}, 'approved', 'wordpress', ${escape(record.created)}, ${escape(record.created)});`,
      );
      approved += 1;
    }
  }

  return { rows, approved, orphanParents };
};

export const renderCommentImport = (rows) => `${rows.join('\n')}\n`;

export const generateCommentImport = (
  input,
  outputDirectory = process.cwd(),
) => {
  const parsed = parser.parse(fs.readFileSync(input, 'utf8'));
  const items = parsed?.rss?.channel?.item || [];
  const { rows, approved, orphanParents } = buildCommentRows(items);
  const backupsDirectory = path.resolve(outputDirectory, 'backups');
  const migrationDirectory = path.resolve(outputDirectory, 'migration');
  fs.mkdirSync(backupsDirectory, { recursive: true });
  fs.mkdirSync(migrationDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(backupsDirectory, 'comment-import.sql'),
    renderCommentImport(rows),
  );
  fs.writeFileSync(
    path.join(migrationDirectory, 'comment-report.json'),
    `${JSON.stringify({ source: input, approved, orphanParents }, null, 2)}\n`,
  );
  return { approved, orphanParents, statements: rows.length };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const input = process.argv[2];
  if (!input)
    throw new Error(
      'Usage: node scripts/import-wordpress-comments.mjs path/to/wordpress.xml',
    );
  const result = generateCommentImport(input);
  console.log(
    `Generated ${result.statements} approved comment import statements in backups/comment-import.sql. Review migration/comment-report.json.`,
  );
}
