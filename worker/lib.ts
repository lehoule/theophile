export type CommentStatus = 'pending' | 'approved' | 'spam' | 'deleted';

export interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  status: CommentStatus;
  created_at: string;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) } });
}

export function bad(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

export function isSameOrigin(request: Request, origin: string): boolean {
  const requestOrigin = request.headers.get('origin');
  return !requestOrigin || requestOrigin === origin;
}

export function validateCommentInput(input: unknown): { name: string; email: string | null; body: string; honeypot: string } | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const email = typeof value.email === 'string' && value.email.trim() ? value.email.trim().toLowerCase() : null;
  const body = typeof value.body === 'string' ? value.body.trim() : '';
  const honeypot = typeof value.website === 'string' ? value.website : '';
  if (name.length < 2 || name.length > 80 || /[\r\n]/.test(name) || body.length < 2 || body.length > 5000) return null;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return null;
  if (/<\/?(script|iframe|object|style)\b/i.test(body)) return null;
  if ((body.match(/https?:\/\//gi) || []).length > 3) return null;
  return { name, email, body, honeypot };
}

export async function hashIp(request: Request, secret: string): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const data = new TextEncoder().encode(`${secret}:${ip}:${new Date().toISOString().slice(0, 10)}`);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function validateTurnstile(token: unknown, request: Request, secret: string): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false;
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: request.headers.get('CF-Connecting-IP') || undefined }),
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

export function cursorFor(createdAt: string, id: string): string {
  return btoa(JSON.stringify({ createdAt, id }));
}

export function parseCursor(value: string | null): { createdAt: string; id: string } | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(atob(value)) as { createdAt?: unknown; id?: unknown };
    return typeof decoded.createdAt === 'string' && typeof decoded.id === 'string' ? { createdAt: decoded.createdAt, id: decoded.id } : null;
  } catch { return null; }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4);
    const payload = JSON.parse(atob(normalized)) as unknown;
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  } catch { return null; }
}

export function adminEmail(request: Request, expected: string, audience?: string): string | null {
  const email = request.headers.get('CF-Access-Authenticated-User-Email');
  const jwt = request.headers.get('CF-Access-Jwt-Assertion');
  if (!email || !jwt || email.toLowerCase() !== expected.toLowerCase()) return null;
  const payload = decodeJwtPayload(jwt);
  if (!payload || (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000))) return null;
  const tokenEmail = typeof payload.email === 'string' ? payload.email : typeof payload.sub === 'string' && payload.sub.includes('@') ? payload.sub : '';
  if (tokenEmail && tokenEmail.toLowerCase() !== email.toLowerCase()) return null;
  if (audience && !audience.startsWith('REPLACE_')) {
    const tokenAudience = Array.isArray(payload.aud) ? payload.aud.map(String) : [String(payload.aud || '')];
    if (!tokenAudience.includes(audience)) return null;
  }
  return email;
}
