import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import {
    BACKFILL_CHUNKS,
    LEAGUE_ARCHIVE,
    runSleeperBackfillChunk
} from '$lib/server/sleeperBackfill';

export async function GET({ setHeaders }) {
    setHeaders({
        'cache-control': 'no-store'
    });

    return json({
        enabled: Boolean(env.ARCHIVE_ADMIN_KEY),
        seasons: LEAGUE_ARCHIVE,
        chunks: BACKFILL_CHUNKS
    });
}

export async function POST({ request, setHeaders }) {
    setHeaders({
        'cache-control': 'no-store'
    });

    const configuredKey = env.ARCHIVE_ADMIN_KEY;

    if (!configuredKey) {
        return json(
            {
                ok: false,
                error:
                    'ARCHIVE_ADMIN_KEY is not configured in Vercel.'
            },
            { status: 503 }
        );
    }

    const suppliedKey =
        request.headers.get('x-archive-admin-key') || '';

    if (suppliedKey !== configuredKey) {
        return json(
            {
                ok: false,
                error: 'Invalid archive administrator key.'
            },
            { status: 401 }
        );
    }

    let body;

    try {
        body = await request.json();
    } catch {
        return json(
            {
                ok: false,
                error: 'Request body must be JSON.'
            },
            { status: 400 }
        );
    }

    try {
        const result = await runSleeperBackfillChunk({
            season: Number(body?.season),
            chunk: String(body?.chunk || '')
        });

        return json({
            ok: true,
            result
        });
    } catch (error) {
        console.error('Sleeper archive backfill failed:', error);

        return json(
            {
                ok: false,
                error:
                    error?.message ||
                    'Sleeper backfill failed.'
            },
            { status: 500 }
        );
    }
}
