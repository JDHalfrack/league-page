import { env } from '$env/dynamic/private';
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

let schemaPromise = null;

const databaseUrl = () =>
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.NEON_DATABASE_URL ||
    '';

export const archiveDatabaseEnabled = () => Boolean(databaseUrl());

const getSql = () => {
    const url = databaseUrl();

    if (!url) {
        throw new Error(
            'Persistent archive database is not configured. Set DATABASE_URL in Vercel.'
        );
    }

    return neon(url);
};

export const ensureArchiveSchema = async () => {
    if (!archiveDatabaseEnabled()) return false;

    if (!schemaPromise) {
        schemaPromise = (async () => {
            const sql = getSql();

            await sql`
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
                )
            `;

            await sql`
                CREATE INDEX IF NOT EXISTS api_archive_provider_endpoint_idx
                ON api_archive (provider, endpoint)
            `;

            await sql`
                CREATE INDEX IF NOT EXISTS api_archive_fetched_at_idx
                ON api_archive (fetched_at DESC)
            `;

            await sql`
                CREATE INDEX IF NOT EXISTS api_archive_expires_at_idx
                ON api_archive (expires_at)
            `;

            await sql`
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
                )
            `;

            await sql`
                CREATE INDEX IF NOT EXISTS archive_sync_log_created_at_idx
                ON archive_sync_log (created_at DESC)
            `;

            return true;
        })().catch(error => {
            schemaPromise = null;
            throw error;
        });
    }

    return schemaPromise;
};

const sha256 = value =>
    createHash('sha256')
        .update(JSON.stringify(value))
        .digest('hex');

const recordCount = value => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return null;
};

const parseJsonValue = value => {
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const logSync = async ({
    provider,
    cacheKey,
    endpoint,
    action,
    success,
    payload = null,
    detail = null
}) => {
    if (!archiveDatabaseEnabled()) return;

    try {
        await ensureArchiveSchema();
        const sql = getSql();

        await sql`
            INSERT INTO archive_sync_log (
                provider,
                cache_key,
                endpoint,
                action,
                success,
                record_count,
                detail
            )
            VALUES (
                ${provider},
                ${cacheKey},
                ${endpoint},
                ${action},
                ${success},
                ${recordCount(payload)},
                ${detail}
            )
        `;
    } catch {
        // Logging must never break the application.
    }
};

export const getArchivedResponse = async (provider, cacheKey) => {
    if (!archiveDatabaseEnabled()) return null;

    await ensureArchiveSchema();
    const sql = getSql();

    const rows = await sql`
        SELECT
            provider,
            cache_key,
            endpoint,
            request_meta,
            payload,
            payload_sha256,
            fetched_at,
            expires_at,
            is_final,
            hit_count
        FROM api_archive
        WHERE provider = ${provider}
          AND cache_key = ${cacheKey}
        LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;

    const now = Date.now();
    const expiresAt = row.expires_at
        ? new Date(row.expires_at).getTime()
        : null;

    const fresh =
        row.is_final ||
        expiresAt === null ||
        expiresAt > now;

    /*
        Hit accounting is intentionally fire-and-forget from the caller's point
        of view. It is useful for seeing which archived endpoints save the most
        external API calls, but a failed counter update should never block data.
    */
    sql`
        UPDATE api_archive
        SET hit_count = hit_count + 1,
            last_hit_at = NOW()
        WHERE provider = ${provider}
          AND cache_key = ${cacheKey}
    `.catch(() => {});

    return {
        provider: row.provider,
        cacheKey: row.cache_key,
        endpoint: row.endpoint,
        requestMeta: parseJsonValue(row.request_meta),
        payload: parseJsonValue(row.payload),
        payloadSha256: row.payload_sha256,
        fetchedAt: row.fetched_at,
        expiresAt: row.expires_at,
        isFinal: row.is_final,
        fresh
    };
};

export const putArchivedResponse = async ({
    provider,
    cacheKey,
    endpoint,
    requestMeta = {},
    payload,
    ttlMs = null,
    isFinal = false
}) => {
    if (!archiveDatabaseEnabled()) return false;

    await ensureArchiveSchema();
    const sql = getSql();

    const expiresAt =
        isFinal || ttlMs === null
            ? null
            : new Date(Date.now() + Math.max(0, Number(ttlMs) || 0));

    const payloadHash = sha256(payload);
    const metaJson = JSON.stringify(requestMeta || {});
    const payloadJson = JSON.stringify(payload);

    await sql`
        INSERT INTO api_archive (
            provider,
            cache_key,
            endpoint,
            request_meta,
            payload,
            payload_sha256,
            fetched_at,
            expires_at,
            is_final
        )
        VALUES (
            ${provider},
            ${cacheKey},
            ${endpoint},
            ${metaJson}::jsonb,
            ${payloadJson}::jsonb,
            ${payloadHash},
            NOW(),
            ${expiresAt},
            ${Boolean(isFinal)}
        )
        ON CONFLICT (provider, cache_key)
        DO UPDATE SET
            endpoint = EXCLUDED.endpoint,
            request_meta = EXCLUDED.request_meta,
            payload = EXCLUDED.payload,
            payload_sha256 = EXCLUDED.payload_sha256,
            fetched_at = NOW(),
            expires_at = EXCLUDED.expires_at,
            is_final = EXCLUDED.is_final
    `;

    await logSync({
        provider,
        cacheKey,
        endpoint,
        action: isFinal ? 'archive-final' : 'archive-refresh',
        success: true,
        payload
    });

    return true;
};

export const archivedFetch = async ({
    provider,
    cacheKey,
    endpoint,
    requestMeta = {},
    ttlMs = null,
    isFinal = false,
    fetcher
}) => {
    const databaseEnabled = archiveDatabaseEnabled();
    let archived = null;

    if (databaseEnabled) {
        try {
            archived = await getArchivedResponse(provider, cacheKey);

            if (archived?.fresh) {
                return {
                    value: archived.payload,
                    source: 'archive',
                    stale: false,
                    fetchedAt: archived.fetchedAt
                };
            }
        } catch (error) {
            console.error(
                `[archive] read failed for ${provider} ${endpoint}:`,
                error
            );
        }
    }

    try {
        const value = await fetcher();

        if (databaseEnabled) {
            try {
                await putArchivedResponse({
                    provider,
                    cacheKey,
                    endpoint,
                    requestMeta,
                    payload: value,
                    ttlMs,
                    isFinal
                });
            } catch (error) {
                console.error(
                    `[archive] write failed for ${provider} ${endpoint}:`,
                    error
                );
            }
        }

        return {
            value,
            source: 'remote',
            stale: false,
            fetchedAt: new Date().toISOString()
        };
    } catch (error) {
        /*
            Stale-if-error:
            If a current endpoint cannot refresh but we already have yesterday's
            successful response, serving that is far better than taking the site
            down. Historical/final rows never become stale in the first place.
        */
        if (archived) {
            await logSync({
                provider,
                cacheKey,
                endpoint,
                action: 'stale-fallback',
                success: true,
                payload: archived.payload,
                detail: error?.message || String(error)
            });

            return {
                value: archived.payload,
                source: 'archive',
                stale: true,
                fetchedAt: archived.fetchedAt
            };
        }

        await logSync({
            provider,
            cacheKey,
            endpoint,
            action: 'remote-fetch',
            success: false,
            detail: error?.message || String(error)
        });

        throw error;
    }
};

export const archiveStatus = async () => {
    if (!archiveDatabaseEnabled()) {
        return {
            enabled: false,
            message:
                'DATABASE_URL is not configured. The site is still using live APIs and memory cache only.'
        };
    }

    await ensureArchiveSchema();
    const sql = getSql();

    const summary = await sql`
        SELECT
            provider,
            COUNT(*)::int AS entries,
            COUNT(*) FILTER (WHERE is_final)::int AS final_entries,
            COALESCE(SUM(hit_count), 0)::bigint AS archive_hits,
            MIN(fetched_at) AS oldest_fetch,
            MAX(fetched_at) AS newest_fetch
        FROM api_archive
        GROUP BY provider
        ORDER BY provider
    `;

    const recent = await sql`
        SELECT
            provider,
            endpoint,
            action,
            success,
            record_count,
            detail,
            created_at
        FROM archive_sync_log
        ORDER BY created_at DESC
        LIMIT 20
    `;

    return {
        enabled: true,
        providers: summary.map(row => ({
            provider: row.provider,
            entries: Number(row.entries),
            finalEntries: Number(row.final_entries),
            archiveHits: Number(row.archive_hits),
            oldestFetch: row.oldest_fetch,
            newestFetch: row.newest_fetch
        })),
        recent
    };
};
