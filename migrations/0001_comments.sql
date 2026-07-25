CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  parent_id TEXT REFERENCES comments(id),
  wordpress_id INTEGER,
  author_name TEXT NOT NULL,
  author_email TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'spam', 'deleted')) DEFAULT 'pending',
  source TEXT NOT NULL CHECK (source IN ('live', 'wordpress')) DEFAULT 'live',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS comments_wordpress_id_idx
  ON comments(wordpress_id) WHERE wordpress_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_post_status_created_idx
  ON comments(post_id, status, created_at, id);
CREATE INDEX IF NOT EXISTS comments_status_created_idx
  ON comments(status, created_at, id);

CREATE TABLE IF NOT EXISTS moderation_events (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id),
  action TEXT NOT NULL,
  administrator TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits(window_start);
