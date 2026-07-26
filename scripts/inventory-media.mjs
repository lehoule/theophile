import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root)
  throw new Error(
    'Usage: node scripts/inventory-media.mjs path/to/wp-content/uploads',
  );
const output = process.argv[3] || 'src/data/media-manifest.json';
const mimeByExtension = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf',
};
const generatedVariant = /-(?:\d+x\d+|scaled|rotated)(?=\.[^.]+$)/i;
const entries = [];
function walk(directory) {
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) walk(file);
    else if (!generatedVariant.test(name)) {
      const extension = path.extname(name).slice(1).toLowerCase();
      const mime = mimeByExtension[extension] || 'application/octet-stream';
      const key = path.relative(root, file).split(path.sep).join('/');
      const checksum = crypto
        .createHash('sha256')
        .update(fs.readFileSync(file))
        .digest('hex');
      entries.push({ key, mime, width: null, height: null, alt: '', checksum });
    }
  }
}
walk(root);
entries.sort((a, b) => a.key.localeCompare(b.key));
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(entries, null, 2)}\n`);
console.log(
  `Inventoried ${entries.length} media files in ${output}. Upload originals to the media R2 bucket and fill alt/caption metadata before publishing.`,
);
