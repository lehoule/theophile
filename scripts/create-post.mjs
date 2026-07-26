import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const title = process.argv.slice(2).join(' ').trim();
if (!title)
  throw new Error('Usage: node scripts/create-post.mjs "Article title"');
const date = new Date().toISOString().slice(0, 10);
const slug = title
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
const file = path.join('src/content/posts', `${date}-${slug}.md`);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(
  file,
  `---\ntitle: ${JSON.stringify(title)}\nslug: ${JSON.stringify(slug)}\npublishedAt: ${date}\nauthor: "Théophile"\ncategories: []\ntags: []\ncommentId: ${JSON.stringify(crypto.randomUUID())}\ndraft: true\n---\n\nÉcrivez votre article ici.\n`,
);
console.log(file);
