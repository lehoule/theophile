import { EmailMessage } from 'cloudflare:email';
import { COMMENT_POSTS } from './post-registry.generated';
import {
  adminEmailWithLocalAuth,
  bad,
  cursorFor,
  hashIp,
  isSameOrigin,
  isLoopbackRequest,
  isLocalDevelopment,
  json,
  originForRequest,
  parseCursor,
  validateCommentInput,
  validateTurnstile,
} from './lib';
import { serveLocalMedia, uploadMedia, type MediaUploadEnv } from './media-api';

interface EmailBinding {
  send(message: EmailMessage): Promise<void>;
}
interface Env extends MediaUploadEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  EMAIL?: EmailBinding;
  TURNSTILE_SECRET: string;
}

const postById = (id: string) => COMMENT_POSTS.find((post) => post.id === id);

async function notifyAdmin(
  env: Env,
  post: { title: string; path: string },
  input: { name: string; email: string | null; body: string },
): Promise<void> {
  if (!env.EMAIL || !env.ADMIN_EMAIL || env.ADMIN_EMAIL.startsWith('REPLACE_'))
    return;
  const from = `comments@${new URL(env.SITE_ORIGIN).hostname.replace(/^www\./, '')}`;
  const subject = `New comment pending: ${post.title}`
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 180);
  const body = `From: ${input.name}${input.email ? ` <${input.email}>` : ''}\n\n${input.body}\n\nModerate: ${env.SITE_ORIGIN}/admin/comments/`;
  const raw = `From: ${from}\r\nTo: ${env.ADMIN_EMAIL}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`;
  const message = new EmailMessage(from, env.ADMIN_EMAIL, raw);
  await env.EMAIL.send(message);
}

async function publicComments(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const postId = url.searchParams.get('postId') || '';
  if (!postById(postId)) return bad('Unknown post', 404);
  const cursor = parseCursor(url.searchParams.get('cursor'));
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit') || 50), 1),
    100,
  );
  const query = cursor
    ? env.DB.prepare(
        `SELECT c.id, c.post_id, CASE WHEN p.id IS NULL THEN NULL ELSE c.parent_id END AS parent_id, c.author_name, c.body, c.status, c.created_at FROM comments c LEFT JOIN comments p ON p.id = c.parent_id AND p.status = 'approved' WHERE c.post_id = ? AND c.status = 'approved' AND (c.created_at > ? OR (c.created_at = ? AND c.id > ?)) ORDER BY c.created_at ASC, c.id ASC LIMIT ?`,
      ).bind(postId, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
    : env.DB.prepare(
        `SELECT c.id, c.post_id, CASE WHEN p.id IS NULL THEN NULL ELSE c.parent_id END AS parent_id, c.author_name, c.body, c.status, c.created_at FROM comments c LEFT JOIN comments p ON p.id = c.parent_id AND p.status = 'approved' WHERE c.post_id = ? AND c.status = 'approved' ORDER BY c.created_at ASC, c.id ASC LIMIT ?`,
      ).bind(postId, limit + 1);
  const result = await query.all<{
    id: string;
    post_id: string;
    parent_id: string | null;
    author_name: string;
    body: string;
    status: string;
    created_at: string;
  }>();
  const rows = result.results.slice(0, limit);
  const last = rows.at(-1);
  return json({
    items: rows.map((row) => ({
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id,
      authorName: row.author_name,
      body: row.body,
      createdAt: row.created_at,
    })),
    nextCursor:
      result.results.length > limit && last
        ? cursorFor(last.created_at, last.id)
        : null,
  });
}

async function commentCounts(request: Request, env: Env): Promise<Response> {
  const ids = [
    ...new Set(
      (new URL(request.url).searchParams.get('postIds') || '')
        .split(',')
        .filter((id) => postById(id)),
    ),
  ].slice(0, 50);
  if (!ids.length) return json({ counts: {} });
  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(
    `SELECT post_id, COUNT(*) AS count FROM comments WHERE status = 'approved' AND post_id IN (${placeholders}) GROUP BY post_id`,
  )
    .bind(...ids)
    .all<{ post_id: string; count: number }>();
  return json({
    counts: Object.fromEntries(
      rows.results.map((row) => [row.post_id, row.count]),
    ),
  });
}

async function createComment(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (
    request.method !== 'POST' ||
    !isSameOrigin(
      request,
      originForRequest(request, env.SITE_ORIGIN, env.LOCAL_ADMIN_AUTH),
    )
  )
    return bad('Not allowed', 403);
  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad('Invalid JSON');
  }
  const postId = typeof input.postId === 'string' ? input.postId : '';
  const post = postById(postId);
  const comment = validateCommentInput(input);
  if (!post || !comment || comment.honeypot) return bad('Invalid comment');
  const turnstileValid = isLocalDevelopment(request, env.LOCAL_ADMIN_AUTH)
    ? true
    : await validateTurnstile(
        input.turnstileToken,
        request,
        env.TURNSTILE_SECRET,
      );
  if (!turnstileValid) return bad('Turnstile validation failed', 403);
  const ipHash = await hashIp(request);
  const windowStart = new Date(
    Math.floor(Date.now() / (15 * 60_000)) * 15 * 60_000,
  ).toISOString();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const daily = await env.DB.prepare(
    'SELECT COALESCE(SUM(count), 0) AS count FROM rate_limits WHERE ip_hash = ? AND window_start >= ?',
  )
    .bind(ipHash, dayStart.toISOString())
    .first<{ count: number }>();
  if ((daily?.count || 0) >= 10) return bad('Daily comment limit reached', 429);
  const existing = await env.DB.prepare(
    'SELECT count FROM rate_limits WHERE ip_hash = ? AND window_start = ?',
  )
    .bind(ipHash, windowStart)
    .first<{ count: number }>();
  if ((existing?.count || 0) >= 3) return bad('Too many comments', 429);
  await env.DB.prepare(
    'INSERT INTO rate_limits (ip_hash, window_start, count) VALUES (?, ?, 1) ON CONFLICT(ip_hash, window_start) DO UPDATE SET count = count + 1',
  )
    .bind(ipHash, windowStart)
    .run();
  const duplicate = await env.DB.prepare(
    `SELECT id FROM comments WHERE post_id = ? AND author_name = ? AND body = ? AND created_at > datetime('now', '-1 day') LIMIT 1`,
  )
    .bind(postId, comment.name, comment.body)
    .first();
  if (duplicate) return bad('Duplicate comment', 409);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO comments (id, post_id, author_name, author_email, body, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', 'live', ?, ?)",
  )
    .bind(id, postId, comment.name, comment.email, comment.body, now, now)
    .run();
  ctx.waitUntil(notifyAdmin(env, post, comment).catch(() => undefined));
  return json({ id, status: 'pending' }, { status: 202 });
}

async function adminApi(request: Request, env: Env): Promise<Response> {
  const administrator = adminEmailWithLocalAuth(
    request,
    env.ADMIN_EMAIL,
    env.LOCAL_ADMIN_AUTH,
  );
  if (!administrator) return bad('Authentication required', 401);
  if (
    env.LOCAL_ADMIN_AUTH === 'true' &&
    isLoopbackRequest(request) &&
    !isSameOrigin(request, new URL(request.url).origin)
  )
    return bad('Not allowed', 403);
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const status = url.searchParams.get('status') || 'pending';
    const cursor = parseCursor(url.searchParams.get('cursor'));
    const limit = 50;
    const query = cursor
      ? env.DB.prepare(
          'SELECT id, post_id, parent_id, author_name, author_email, body, status, source, created_at, updated_at FROM comments WHERE status = ? AND (created_at > ? OR (created_at = ? AND id > ?)) ORDER BY created_at ASC, id ASC LIMIT ?',
        ).bind(status, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
      : env.DB.prepare(
          'SELECT id, post_id, parent_id, author_name, author_email, body, status, source, created_at, updated_at FROM comments WHERE status = ? ORDER BY created_at ASC, id ASC LIMIT ?',
        ).bind(status, limit + 1);
    const result = await query.all<Record<string, unknown>>();
    const rows = result.results.slice(0, limit);
    const last = rows.at(-1);
    return json({
      items: rows.map((row) => ({
        ...row,
        post: postById(String(row.post_id)) || null,
      })),
      nextCursor:
        result.results.length > limit && last
          ? cursorFor(String(last.created_at), String(last.id))
          : null,
    });
  }
  const match = url.pathname.match(
    /^\/api\/admin\/comments\/([^/]+)(?:\/replies)?$/,
  );
  if (!match) return bad('Not found', 404);
  const id = match[1];
  const isReply = url.pathname.endsWith('/replies');
  let payload: Record<string, unknown> = {};
  if (request.method !== 'DELETE') {
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return bad('Invalid JSON');
    }
  }
  const existing = await env.DB.prepare('SELECT * FROM comments WHERE id = ?')
    .bind(id)
    .first<{ post_id: string; parent_id: string | null; body: string }>();
  if (!existing) return bad('Comment not found', 404);
  const now = new Date().toISOString();
  if (isReply && request.method === 'POST') {
    const body = typeof payload.body === 'string' ? payload.body.trim() : '';
    if (body.length < 2 || body.length > 5000) return bad('Invalid reply');
    const replyId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO comments (id, post_id, parent_id, author_name, body, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'approved', 'live', ?, ?)",
    )
      .bind(replyId, existing.post_id, id, 'Théophile', body, now, now)
      .run();
    await env.DB.prepare(
      'INSERT INTO moderation_events (id, comment_id, action, administrator, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), replyId, 'reply', administrator, now)
      .run();
    return json({ id: replyId, status: 'approved' }, { status: 201 });
  }
  if (request.method === 'PATCH') {
    const status = payload.status;
    if (!['approved', 'spam', 'pending', 'deleted'].includes(String(status)))
      return bad('Invalid status');
    await env.DB.prepare(
      'UPDATE comments SET status = ?, updated_at = ? WHERE id = ?',
    )
      .bind(status, now, id)
      .run();
    await env.DB.prepare(
      'INSERT INTO moderation_events (id, comment_id, action, administrator, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), id, String(status), administrator, now)
      .run();
    return json({ id, status });
  }
  if (request.method === 'DELETE') {
    const child = await env.DB.prepare(
      'SELECT id FROM comments WHERE parent_id = ? LIMIT 1',
    )
      .bind(id)
      .first();
    if (child)
      await env.DB.prepare(
        "UPDATE comments SET status = 'deleted', author_name = 'Commentaire supprimé', author_email = NULL, body = 'Ce commentaire a été supprimé.', updated_at = ? WHERE id = ?",
      )
        .bind(now, id)
        .run();
    else
      await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
    await env.DB.prepare(
      'INSERT INTO moderation_events (id, comment_id, action, administrator, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), id, 'delete', administrator, now)
      .run();
    return json({ id, status: 'deleted' });
  }
  return bad('Method not allowed', 405);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/comments' && request.method === 'GET')
        return await publicComments(request, env);
      if (url.pathname === '/api/comments/counts' && request.method === 'GET')
        return await commentCounts(request, env);
      if (url.pathname === '/api/comments' && request.method === 'POST')
        return await createComment(request, env, ctx);
      if (url.pathname.startsWith('/__local-media/')) {
        const localMedia = await serveLocalMedia(request, env);
        if (localMedia) return localMedia;
      }
      if (url.pathname === '/api/admin/media')
        return await uploadMedia(request, env);
      if (url.pathname.startsWith('/api/admin/'))
        return await adminApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return bad('Internal server error', 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await env.DB.prepare(
      "DELETE FROM rate_limits WHERE window_start < datetime('now', '-1 day')",
    ).run();
  },
};
