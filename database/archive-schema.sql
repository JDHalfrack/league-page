-- USCCFFL Persistent API Archive v0.1
-- This schema is created automatically by src/lib/server/archiveDb.js.
-- The file is included for inspection/manual recovery only.

CREATE TABLE IF NOT EXISTS api_archive (
    provider TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL,
    payload_sha256 TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    hit_count BIGINT NOT NULL DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    PRIMARY KEY (provider, cache_key)
);

CREATE INDEX IF NOT EXISTS api_archive_provider_endpoint_idx
ON api_archive (provider, endpoint);

CREATE INDEX IF NOT EXISTS api_archive_fetched_at_idx
ON api_archive (fetched_at DESC);

CREATE INDEX IF NOT EXISTS api_archive_expires_at_idx
ON api_archive (expires_at);

CREATE TABLE IF NOT EXISTS archive_sync_log (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    action TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    record_count INTEGER,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS archive_sync_log_created_at_idx
ON archive_sync_log (created_at DESC);
