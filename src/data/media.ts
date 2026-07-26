export interface MediaManifestEntry {
  key: string;
  mime: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption?: string;
  checksum: string;
}

import manifest from './media-manifest.json';

export const mediaManifest = manifest as MediaManifestEntry[];

export function mediaUrl(key: string, width?: number): string {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return width
    ? `https://media.theophile.xyz/cdn-cgi/image/width=${width},format=auto/${encodedKey}`
    : `https://media.theophile.xyz/${encodedKey}`;
}
