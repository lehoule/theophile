import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/content/posts');
const entries = [];
function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (name.endsWith('.md')) {
      const source = fs.readFileSync(file, 'utf8');
      const frontmatter = source.match(/^---\n([\s\S]*?)\n---/m)?.[1] || '';
      const title = frontmatter.match(/^title:\s*["']?(.*?)["']?\s*$/m)?.[1] || name;
      const slug = frontmatter.match(/^slug:\s*["']?(.*?)["']?\s*$/m)?.[1] || name.replace(/\.md$/, '');
      const commentId = frontmatter.match(/^commentId:\s*["']?(.*?)["']?\s*$/m)?.[1] || frontmatter.match(/^legacyWordPressId:\s*(\d+)\s*$/m)?.[1];
      const publishedAt = frontmatter.match(/^publishedAt:\s*["']?(\d{4})-(\d{2})-(\d{2})/)?.slice(1);
      const draft = frontmatter.match(/^draft:\s*(true|false)\s*$/m)?.[1] === 'true';
      if (!draft && commentId && publishedAt) entries.push({ id: commentId, path: `/${publishedAt[0]}/${publishedAt[1]}/${slug}/`, title });
    }
  }
}
walk(root);
const destination = path.resolve('worker/post-registry.generated.ts');
fs.writeFileSync(destination, `// Generated file. Do not edit.\nexport type CommentPost = { id: string; path: string; title: string };\nexport const COMMENT_POSTS: CommentPost[] = ${JSON.stringify(entries, null, 2)};\n`);
console.log(`Generated comment registry with ${entries.length} post(s).`);
