CREATE TABLE IF NOT EXISTS hk_import_locks (
  name TEXT PRIMARY KEY,
  run_id UUID,
  owner TEXT NOT NULL DEFAULT '',
  locked_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS hk_import_runs (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'heureka',
  mode TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total_feeds INT NOT NULL DEFAULT 0,
  processed_feeds INT NOT NULL DEFAULT 0,
  successful_feeds INT NOT NULL DEFAULT 0,
  failed_feeds INT NOT NULL DEFAULT 0,
  cursor_feed_id TEXT,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hk_import_runs_status_check CHECK (status IN ('running', 'partial', 'success', 'error')),
  CONSTRAINT hk_import_runs_mode_check CHECK (mode IN ('audit', 'full'))
);

CREATE INDEX IF NOT EXISTS hk_import_runs_type_status_idx
  ON hk_import_runs(type, status, started_at DESC);

CREATE TABLE IF NOT EXISTS hk_import_run_feeds (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES hk_import_runs(id) ON DELETE CASCADE,
  feed_id TEXT NOT NULL REFERENCES hk_feeds(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_type TEXT,
  error_message TEXT,
  product_count INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, feed_id),
  CONSTRAINT hk_import_run_feeds_status_check CHECK (
    status IN ('pending', 'running', 'success', 'empty', 'error', 'partial', 'truncated')
  )
);

CREATE INDEX IF NOT EXISTS hk_import_run_feeds_run_status_idx
  ON hk_import_run_feeds(run_id, status);

CREATE INDEX IF NOT EXISTS hk_import_run_feeds_feed_idx
  ON hk_import_run_feeds(feed_id);
