import { json } from './lib';

export async function deleteComment(
  db: D1Database,
  id: string,
  administrator: string,
  now: string,
): Promise<Response> {
  await db.batch([
    db
      .prepare(
        "UPDATE comments SET status = 'deleted', author_name = 'Commentaire supprimé', author_email = NULL, body = 'Ce commentaire a été supprimé.', updated_at = ? WHERE id = ?",
      )
      .bind(now, id),
    db
      .prepare(
        'INSERT INTO moderation_events (id, comment_id, action, administrator, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(crypto.randomUUID(), id, 'delete', administrator, now),
  ]);

  return json({ id, status: 'deleted' });
}

export async function editReply(
  db: D1Database,
  id: string,
  body: string,
  administrator: string,
  now: string,
): Promise<Response> {
  await db.batch([
    db
      .prepare('UPDATE comments SET body = ?, updated_at = ? WHERE id = ?')
      .bind(body, now, id),
    db
      .prepare(
        'INSERT INTO moderation_events (id, comment_id, action, administrator, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(crypto.randomUUID(), id, 'edit', administrator, now),
  ]);

  return json({ id, status: 'approved', body });
}
