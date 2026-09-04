import { archivedFetch } from '$lib/server/archiveDb';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const MAX_RETRIES = 4;

const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

const buildUrl = pathOrUrl => {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }

    const path = String(pathOrUrl || '');
    return `${SLEEPER_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};

const retryDelay = (response, attempt) => {
    const retryAfter = response.headers.get('retry-after');

    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds > 0) {
            return seconds * 1000;
        }
    }

    return 500 * Math.pow(2, attempt);
};

const fetchSleeperJson = async (url, notFoundValue) => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'USCCFFL-League-Page'
            }
        });

        if (response.ok) {
            return response.json();
        }

        if (
            response.status === 404 &&
            notFoundValue !== undefined
        ) {
            return notFoundValue;
        }

        if (
            (response.status === 429 || response.status >= 500) &&
            attempt < MAX_RETRIES
        ) {
            await sleep(retryDelay(response, attempt));
            continue;
        }

        const detail = await response.text().catch(() => '');

        throw new Error(
            `Sleeper request failed with ${response.status}${
                detail ? `: ${detail.slice(0, 300)}` : ''
            }`
        );
    }

    throw new Error(
        `Sleeper request failed after ${MAX_RETRIES + 1} attempts: ${url}`
    );
};

export const sleeperGet = async (
    pathOrUrl,
    {
        ttlMs = 15 * 60 * 1000,
        isFinal = false,
        metadata = {},
        notFoundValue
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
        fetcher: () => fetchSleeperJson(url, notFoundValue)
    });

    return result.value;
};

export const sleeperHistoricalGet = async (
    pathOrUrl,
    metadata = {},
    options = {}
) =>
    sleeperGet(pathOrUrl, {
        ttlMs: null,
        isFinal: true,
        metadata,
        ...options
    });
