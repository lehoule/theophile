import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  adminEmail,
  bad,
  cursorFor,
  hashIp,
  isSameOrigin,
  json,
  parseCursor,
  validateCommentInput,
  validateTurnstile,
} from '../worker/lib';

const jwt = (payload: Record<string, unknown>) => {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('JSON responses and origins', () => {
  it('serializes JSON with the expected content type and status', async () => {
    const response = json(
      { ok: true },
      { status: 201, headers: { 'x-request-id': 'abc' } },
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-request-id')).toBe('abc');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('formats an error response', async () => {
    const response = bad('Not found', 404);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('allows requests without an origin and rejects another origin', () => {
    const origin = 'https://www.example.com';

    expect(
      isSameOrigin(new Request('https://www.example.com/api/comments'), origin),
    ).toBe(true);
    expect(
      isSameOrigin(
        new Request('https://www.example.com/api/comments', {
          headers: { origin },
        }),
        origin,
      ),
    ).toBe(true);
    expect(
      isSameOrigin(
        new Request('https://www.example.com/api/comments', {
          headers: { origin: 'https://evil.example' },
        }),
        origin,
      ),
    ).toBe(false);
  });
});

describe('comment validation', () => {
  it('trims text, normalizes email, and preserves the honeypot value', () => {
    expect(
      validateCommentInput({
        name: '  Sonny  ',
        email: ' SONNY@EXAMPLE.COM ',
        body: '  Bonjour.  ',
        website: 'bot',
      }),
    ).toEqual({
      name: 'Sonny',
      email: 'sonny@example.com',
      body: 'Bonjour.',
      honeypot: 'bot',
    });
  });

  it.each([
    ['non-object input', null],
    [
      'invalid email',
      { name: 'Sonny', email: 'not-an-email', body: 'Bonjour.' },
    ],
    ['line break in name', { name: 'Sonny\nAdmin', body: 'Bonjour.' }],
    [
      'disallowed markup',
      { name: 'Sonny', body: '<iframe src="evil"></iframe>' },
    ],
    [
      'too many links',
      {
        name: 'Sonny',
        body: 'http://a.test http://b.test http://c.test http://d.test',
      },
    ],
  ])('rejects %s', (_label, input) => {
    expect(validateCommentInput(input)).toBeNull();
  });
});

describe('IP hashing and Turnstile validation', () => {
  it('hashes the same IP consistently for a day and separates different IPs', async () => {
    vi.setSystemTime(new Date('2026-07-25T12:00:00.000Z'));
    const firstRequest = new Request('https://www.example.com', {
      headers: { 'CF-Connecting-IP': '192.0.2.1' },
    });
    const sameIp = await hashIp(firstRequest, 'secret');
    const repeated = await hashIp(firstRequest, 'secret');
    const differentIp = await hashIp(
      new Request('https://www.example.com', {
        headers: { 'CF-Connecting-IP': '192.0.2.2' },
      }),
      'secret',
    );

    expect(sameIp).toMatch(/^[0-9a-f]{64}$/);
    expect(repeated).toBe(sameIp);
    expect(differentIp).not.toBe(sameIp);
  });

  it('does not call Turnstile for a missing token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      validateTurnstile('', new Request('https://www.example.com'), 'secret'),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the verification result and sends the client IP', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://www.example.com', {
      headers: { 'CF-Connecting-IP': '192.0.2.10' },
    });

    await expect(
      validateTurnstile('turnstile-token', request, 'secret'),
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          secret: 'secret',
          response: 'turnstile-token',
          remoteip: '192.0.2.10',
        }),
      }),
    );
  });

  it('rejects an unsuccessful or non-OK Turnstile response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://www.example.com');

    await expect(validateTurnstile('token', request, 'secret')).resolves.toBe(
      false,
    );
    await expect(validateTurnstile('token', request, 'secret')).resolves.toBe(
      false,
    );
  });
});

describe('pagination cursors', () => {
  it('round-trips a cursor', () => {
    const cursor = cursorFor('2026-07-25T12:00:00.000Z', 'comment-2');

    expect(parseCursor(cursor)).toEqual({
      createdAt: '2026-07-25T12:00:00.000Z',
      id: 'comment-2',
    });
  });

  it.each([
    null,
    '',
    'not-base64',
    btoa(JSON.stringify({ createdAt: 42, id: 'comment-1' })),
    btoa('[]'),
  ])('returns null for malformed cursor %s', (cursor) => {
    expect(parseCursor(cursor)).toBeNull();
  });
});

describe('admin access validation', () => {
  it('accepts a matching, non-expired access assertion', () => {
    const request = new Request('https://www.example.com', {
      headers: {
        'CF-Access-Authenticated-User-Email': 'Admin@Example.com',
        'CF-Access-Jwt-Assertion': jwt({
          email: 'admin@example.com',
          exp: Math.floor(Date.now() / 1000) + 60,
          aud: ['app-audience'],
        }),
      },
    });

    expect(adminEmail(request, 'admin@example.com', 'app-audience')).toBe(
      'Admin@Example.com',
    );
  });

  it.each([
    ['missing assertion', {}],
    ['wrong header email', { email: 'other@example.com' }],
    [
      'expired assertion',
      { email: 'admin@example.com', exp: Math.floor(Date.now() / 1000) - 1 },
    ],
    ['wrong token email', { email: 'other@example.com' }],
    ['wrong audience', { email: 'admin@example.com', aud: ['different-app'] }],
  ])('rejects %s', (_label, payload) => {
    const headers = new Headers({
      'CF-Access-Authenticated-User-Email': 'admin@example.com',
    });
    if (_label === 'wrong header email')
      headers.set('CF-Access-Authenticated-User-Email', 'other@example.com');
    if (_label === 'missing assertion')
      headers.set('CF-Access-Jwt-Assertion', '');
    else headers.set('CF-Access-Jwt-Assertion', jwt(payload));

    expect(
      adminEmail(
        new Request('https://www.example.com', { headers }),
        'admin@example.com',
        'app-audience',
      ),
    ).toBeNull();
  });

  it('accepts a subject email when the assertion omits email', () => {
    const request = new Request('https://www.example.com', {
      headers: {
        'CF-Access-Authenticated-User-Email': 'admin@example.com',
        'CF-Access-Jwt-Assertion': jwt({
          sub: 'ADMIN@example.com',
          aud: 'app-audience',
        }),
      },
    });

    expect(adminEmail(request, 'admin@example.com', 'app-audience')).toBe(
      'admin@example.com',
    );
  });
});
