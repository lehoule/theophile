import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  markdownForMedia,
  mediaKey,
  mediaType,
  MAX_MEDIA_BYTES,
} from '../worker/media';
import { serveLocalMedia, uploadMedia } from '../worker/media-api';

const encode = (value: unknown) =>
  btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const accessHeaders = () => ({
  'CF-Access-Authenticated-User-Email': 'admin@example.com',
  'CF-Access-Jwt-Assertion': `${encode({ alg: 'none' })}.${encode({ email: 'admin@example.com', aud: ['media-app'] })}.signature`,
});

const environment = (put = vi.fn().mockResolvedValue(undefined)) =>
  ({
    ADMIN_EMAIL: 'admin@example.com',
    SITE_ORIGIN: 'https://www.theophile.blog',
    TURNSTILE_SECRET: 'secret',
    MEDIA: { put },
    MEDIA_PUBLIC_ORIGIN: 'https://media.theophile.blog',
  }) as unknown as Parameters<typeof uploadMedia>[1];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('media helpers', () => {
  it('accepts supported MIME types and infers a missing browser type', () => {
    expect(mediaType('photo.JPG', 'image/jpeg')).toEqual({
      mime: 'image/jpeg',
      extension: 'jpg',
    });
    expect(mediaType('conference.mp3', 'application/octet-stream')).toEqual({
      mime: 'audio/mpeg',
      extension: 'mp3',
    });
    expect(mediaType('script.html', 'text/html')).toBeNull();
  });

  it('creates a safe dated key and Markdown snippet', () => {
    expect(
      mediaKey('Été à Québec!.jpg', 'jpg', new Date('2026-07-25'), 'abc123'),
    ).toBe('2026/07/ete-a-quebec-abc123.jpg');
    expect(
      markdownForMedia(
        'image/jpeg',
        'photo.jpg',
        'https://media.theophile.blog/2026/07/photo.jpg',
        'Une [photo]\navec une description',
      ),
    ).toBe(
      '![Une photo avec une description](https://media.theophile.blog/2026/07/photo.jpg)',
    );
  });
});

describe('media upload API', () => {
  it('rejects unauthenticated uploads without touching R2', async () => {
    const put = vi.fn();
    const response = await uploadMedia(
      new Request('https://www.theophile.blog/api/admin/media', {
        method: 'POST',
        body: 'file',
      }),
      environment(put),
    );

    expect(response.status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });

  it('allows local development auth only on a loopback host', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const localEnv = {
      ...environment(put),
      LOCAL_ADMIN_AUTH: 'true',
    };
    const localResponse = await uploadMedia(
      new Request('http://localhost:8787/api/admin/media', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:8787',
          'content-type': 'audio/mpeg',
          'content-length': '4',
          'x-media-filename': 'conference.mp3',
        },
        body: 'data',
      }),
      localEnv,
    );
    expect(localResponse.status).toBe(201);

    const productionResponse = await uploadMedia(
      new Request('https://www.theophile.blog/api/admin/media', {
        method: 'POST',
        headers: {
          origin: 'https://www.theophile.blog',
          'content-type': 'audio/mpeg',
          'content-length': '4',
          'x-media-filename': 'conference.mp3',
        },
        body: 'data',
      }),
      localEnv,
    );
    expect(productionResponse.status).toBe(401);
    expect(put).toHaveBeenCalledOnce();
  });

  it('serves locally uploaded media only on a loopback host', async () => {
    const object = {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data'));
          controller.close();
        },
      }),
      httpEtag: '"local-etag"',
      writeHttpMetadata(headers: Headers) {
        headers.set('content-type', 'audio/mpeg');
      },
    } as R2ObjectBody;
    const get = vi.fn().mockResolvedValue(object);
    const env = {
      ...environment(),
      LOCAL_ADMIN_AUTH: 'true',
      MEDIA: { get },
    } as unknown as Parameters<typeof serveLocalMedia>[1];

    const response = await serveLocalMedia(
      new Request(
        'http://localhost:8787/__local-media/2026/07/conference-abc123.mp3',
      ),
      env,
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toBe('audio/mpeg');
    await expect(response?.text()).resolves.toBe('data');
    expect(get).toHaveBeenCalledWith('2026/07/conference-abc123.mp3');

    const productionResponse = await serveLocalMedia(
      new Request(
        'https://www.theophile.blog/__local-media/2026/07/conference-abc123.mp3',
      ),
      env,
    );
    expect(productionResponse).toBeNull();
  });

  it('uploads an authorized file and returns a copyable Markdown snippet', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const response = await uploadMedia(
      new Request('https://www.theophile.blog/api/admin/media', {
        method: 'POST',
        headers: {
          ...accessHeaders(),
          origin: 'https://www.theophile.blog',
          'content-type': 'image/jpeg',
          'content-length': '4',
          'x-media-filename': encodeURIComponent('Été.jpg'),
          'x-media-alt': encodeURIComponent('Une photo estivale'),
          'x-media-caption': encodeURIComponent('Souvenir'),
        },
        body: 'data',
      }),
      environment(put),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        mime: 'image/jpeg',
        url: expect.stringMatching(
          /^https:\/\/media\.theophile\.blog\/\d{4}\/\d{2}\//,
        ),
        markdown: expect.stringContaining('Une photo estivale'),
      }),
    );
    expect(put).toHaveBeenCalledOnce();
  });

  it('rejects unsupported and oversized files', async () => {
    const put = vi.fn();
    const base = {
      ...accessHeaders(),
      origin: 'https://www.theophile.blog',
      'content-type': 'text/html',
      'content-length': '4',
      'x-media-filename': 'page.html',
    };
    const unsupported = await uploadMedia(
      new Request('https://www.theophile.blog/api/admin/media', {
        method: 'POST',
        headers: base,
        body: 'data',
      }),
      environment(put),
    );
    expect(unsupported.status).toBe(415);

    const oversized = await uploadMedia(
      new Request('https://www.theophile.blog/api/admin/media', {
        method: 'POST',
        headers: {
          ...accessHeaders(),
          origin: 'https://www.theophile.blog',
          'content-type': 'image/jpeg',
          'content-length': String(MAX_MEDIA_BYTES + 1),
          'x-media-filename': 'large.jpg',
          'x-media-alt': 'Grande image',
        },
        body: 'data',
      }),
      environment(put),
    );
    expect(oversized.status).toBe(413);
    expect(put).not.toHaveBeenCalled();
  });
});
