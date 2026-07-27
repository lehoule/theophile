import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

export function isPublishableMediaPath(relativePath) {
  const normalizedPath = relativePath.split(path.sep).join('/');
  const [year, month] = normalizedPath.split('/');
  return /^\d{4}$/.test(year) && /^(0[1-9]|1[0-2])$/.test(month);
}

export function inventoryMedia(root) {
  const entries = [];
  function walk(directory) {
    for (const name of fs.readdirSync(directory)) {
      const file = path.join(directory, name);
      const relativePath = path.relative(root, file);
      const stat = fs.statSync(file);
      if (stat.isDirectory()) {
        // WordPress stores normal uploads under YYYY/MM. Top-level directories
        // such as wpconsent and wp-statistics are plugin-generated files.
        if (directory === root && !/^\d{4}$/.test(name)) continue;
        walk(file);
      } else if (
        !generatedVariant.test(name) &&
        isPublishableMediaPath(relativePath)
      ) {
        const extension = path.extname(name).slice(1).toLowerCase();
        const mime = mimeByExtension[extension] || 'application/octet-stream';
        const key = relativePath.split(path.sep).join('/');
        const checksum = crypto
          .createHash('sha256')
          .update(fs.readFileSync(file))
          .digest('hex');
        entries.push({
          key,
          mime,
          width: null,
          height: null,
          alt: '',
          checksum,
        });
      }
    }
  }
  walk(root);
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export function main(root, output = 'src/data/media-manifest.json') {
  if (!root)
    throw new Error(
      'Usage: node scripts/inventory-media.mjs path/to/wp-content/uploads',
    );

  const entries = inventoryMedia(root);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(
    `Inventoried ${entries.length} media files in ${output}. Upload originals to the media R2 bucket and fill alt/caption metadata before publishing.`,
  );
}

if (process.argv[1] === new URL(import.meta.url).pathname)
  main(process.argv[2], process.argv[3]);
