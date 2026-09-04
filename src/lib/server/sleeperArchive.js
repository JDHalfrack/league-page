import { archivedFetch } from '$lib/server/archiveDb';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

const buildUrl = pathOrUrl => {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }

    const path = String(pathOrUrl || '');
    return `${SLEEPER_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};

const fetchSleeperJson = async url => {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'USCCFFL-League-Page'
        }
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');

        throw new Error(
            `Sleeper request failed with ${response.status}${
                detail ? `: ${detail.slice(0, 300)}` : ''
            }`
        );
    }

    return response.json();
};

/*
    Generic persistent Sleeper reader.

    Existing Sleeper-backed features can migrate to this one call at a time:
        const rows = await sleeperGet('/league/123/matchups/7', {
            isFinal: true,
            metadata: { season: 2024, week: 7, type: 'matchups' }
        });

    Historical/final data is fetched once and then lives in Postgres forever.
    Current data can be given a TTL and the last successful snapshot remains
    available as a stale fallback if Sleeper is temporarily unavailable.
*/
export const sleeperGet = async (
    pathOrUrl,
    {
        ttlMs = 15 * 60 * 1000,
        isFinal = false,
        metadata = {}
    } = {}
) => {
    const url = buildUrl(pathOrUrl);

    const result = await archivedFetch({
        provider: 'sleeper',
        cacheKey: url,
        endpoint: new URL(url).pathname,
        requestMeta: {
            ...metadata,
            url
        },
        ttlMs,
        isFinal,
        fetcher: () => fetchSleeperJson(url)
    });

    return result.value;
};

export const sleeperHistoricalGet = async (
    pathOrUrl,
    metadata = {}
) =>
    sleeperGet(pathOrUrl, {
        ttlMs: null,
        isFinal: true,
        metadata
    });
