export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

const EXTENSION_MIMES: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXTENSIONS).map(([mime, extension]) => [extension, mime]),
);

export interface MediaType {
  mime: string;
  extension: string;
}

export function mediaType(
  filename: string,
  declaredMime: string,
): MediaType | null {
  const mime = declaredMime.split(';', 1)[0].trim().toLowerCase();
  if (MIME_EXTENSIONS[mime]) return { mime, extension: MIME_EXTENSIONS[mime] };

  const extension = filename
    .split(/[\\/]/)
    .at(-1)
    ?.split('.')
    .at(-1)
    ?.toLowerCase();
  if ((mime === '' || mime === 'application/octet-stream') && extension) {
    const inferredMime = EXTENSION_MIMES[extension];
    if (inferredMime)
      return { mime: inferredMime, extension: MIME_EXTENSIONS[inferredMime] };
  }
  return null;
}

function safeBaseName(filename: string): string {
  const base = filename.split(/[\\/]/).at(-1) || 'media';
  const withoutExtension = base.replace(/\.[^.]*$/, '');
  const normalized = withoutExtension
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80);
  return normalized || 'media';
}

export function mediaKey(
  filename: string,
  extension: string,
  now = new Date(),
  id = crypto.randomUUID().slice(0, 8),
): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${safeBaseName(filename)}-${id}.${extension}`;
}

export function decodeMediaHeader(value: string | null): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return '';
  }
}

export function markdownForMedia(
  mime: string,
  filename: string,
  url: string,
  alt: string,
): string {
  const safeAlt = alt
    .replace(/[\r\n]+/g, ' ')
    .replaceAll('[', '')
    .replaceAll(']', '')
    .trim();
  if (mime.startsWith('image/')) return `![${safeAlt}](${url})`;
  const label = filename.split(/[\\/]/).at(-1) || 'média';
  return `[${label}](${url})`;
}
