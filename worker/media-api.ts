import {
  adminEmailWithLocalAuth,
  bad,
  isLocalDevelopment,
  isSameOrigin,
  json,
  originForRequest,
} from './lib';
import {
  decodeMediaHeader,
  markdownForMedia,
  MAX_MEDIA_BYTES,
  mediaKey,
  mediaType,
} from './media';

export interface MediaUploadEnv {
  ADMIN_EMAIL: string;
  LOCAL_ADMIN_AUTH?: string;
  SITE_ORIGIN: string;
  MEDIA: R2Bucket;
  MEDIA_PUBLIC_ORIGIN?: string;
}

function administratorForMedia(
  request: Request,
  env: MediaUploadEnv,
): { email: string | null; local: boolean } {
  const local = isLocalDevelopment(request, env.LOCAL_ADMIN_AUTH);
  return {
    email: adminEmailWithLocalAuth(
      request,
      env.ADMIN_EMAIL,
      env.LOCAL_ADMIN_AUTH,
    ),
    local,
  };
}

export async function uploadMedia(
  request: Request,
  env: MediaUploadEnv,
): Promise<Response> {
  const { email: administrator, local } = administratorForMedia(request, env);
  if (!administrator) return bad('Authentication required', 401);
  if (request.method !== 'POST') return bad('Method not allowed', 405);
  if (
    !isSameOrigin(
      request,
      originForRequest(request, env.SITE_ORIGIN, env.LOCAL_ADMIN_AUTH),
    )
  )
    return bad('Not allowed', 403);

  const filename = decodeMediaHeader(request.headers.get('x-media-filename'));
  const alt = decodeMediaHeader(request.headers.get('x-media-alt'));
  const caption = decodeMediaHeader(request.headers.get('x-media-caption'));
  const contentLength = Number(
    request.headers.get('content-length') ||
      request.headers.get('x-media-size'),
  );
  const type = mediaType(filename, request.headers.get('content-type') || '');

  if (!filename || filename.length > 200 || !type)
    return bad('Unsupported media file', 415);
  if (type.mime.startsWith('image/') && !alt)
    return bad('Image alt text is required');
  if (alt.length > 300 || caption.length > 500)
    return bad('Media description is too long');
  if (!Number.isSafeInteger(contentLength) || contentLength < 1)
    return bad('A file is required', 400);
  if (contentLength > MAX_MEDIA_BYTES) return bad('The file is too large', 413);
  if (!request.body) return bad('A file is required', 400);

  const key = mediaKey(filename, type.extension);
  await env.MEDIA.put(key, request.body, {
    httpMetadata: {
      contentType: type.mime,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { alt, caption, uploadedBy: administrator },
  });

  const origin = local
    ? new URL(request.url).origin
    : (env.MEDIA_PUBLIC_ORIGIN || 'https://media.theophile.blog').replace(
        /\/+$/,
        '',
      );
  const url = local ? `${origin}/__local-media/${key}` : `${origin}/${key}`;
  return json(
    {
      key,
      mime: type.mime,
      url,
      markdown: markdownForMedia(type.mime, filename, url, alt),
    },
    { status: 201 },
  );
}

export async function serveLocalMedia(
  request: Request,
  env: MediaUploadEnv,
): Promise<Response | null> {
  if (!isLocalDevelopment(request, env.LOCAL_ADMIN_AUTH)) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return bad('Method not allowed', 405);

  const prefix = '/__local-media/';
  const encodedKey = new URL(request.url).pathname.slice(prefix.length);
  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    return bad('Invalid media key', 400);
  }
  if (!key || key.includes('..') || key.startsWith('/'))
    return bad('Invalid media key', 400);

  const object = await env.MEDIA.get(key);
  if (!object) return bad('Media not found', 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(request.method === 'HEAD' ? null : object.body, {
    headers,
  });
}
