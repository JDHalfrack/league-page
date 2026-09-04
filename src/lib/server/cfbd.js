import { env } from '$env/dynamic/private';
import { archivedFetch } from '$lib/server/archiveDb';

const BASE_URL = 'https://api.collegefootballdata.com';
const MAX_RETRIES = 4;
const MEMORY_CACHE_TTL_MS = 30 * 60 * 1000;

const memoryCache = new Map();
const inFlight = new Map();

const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

const buildUrl = (path, params = {}) => {
    const url = new URL(`${BASE_URL}${path}`);

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
    }

    return url;
};

const retryDelay = (response, attempt) => {
    const retryAfter = response.headers.get('retry-after');

    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds > 0) {
            return seconds * 1000;
        }
    }

    // 0.75s, 1.5s, 3s, 6s
    return 750 * Math.pow(2, attempt);
};

const pruneMemoryCache = now => {
    if (memoryCache.size < 80) return;

    for (const [key, entry] of memoryCache.entries()) {
        if (entry.expiresAt <= now) {
            memoryCache.delete(key);
        }
    }
};

const requestJson = async (url, apiKey, path) => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json'
            }
        });

        if (response.ok) {
            return response.json();
        }

        let detail = '';
        try {
            detail = await response.text();
        } catch {
            detail = '';
        }

        if (response.status === 429 && attempt < MAX_RETRIES) {
            await sleep(retryDelay(response, attempt));
            continue;
        }

        throw new Error(
            `CFBD ${path} failed with ${response.status}${
                detail ? `: ${detail.slice(0, 300)}` : ''
            }`
        );
    }

    throw new Error(`CFBD ${path} failed after ${MAX_RETRIES + 1} attempts.`);
};

const archivePolicy = (path, params = {}) => {
    const currentYear = new Date().getUTCFullYear();
    const requestYear = Number(params.year);

    /*
        A year older than the current calendar year is treated as immutable.
        That means the first successful request for 2021/2022/etc. is written
        permanently and should never consume another CFBD request.

        Current-year data is also persisted immediately, but remains refreshable
        on a controlled TTL so new games/recruiting/rating updates can replace
        the stored snapshot.
    */
    if (Number.isFinite(requestYear) && requestYear < currentYear) {
        return {
            isFinal: true,
            ttlMs: null
        };
    }

    if (path === '/stats/player/season') {
        return {
            isFinal: false,
            ttlMs: 4 * 60 * 60 * 1000
        };
    }

    if (path === '/recruiting/players') {
        return {
            isFinal: false,
            ttlMs: 12 * 60 * 60 * 1000
        };
    }

    if (path === '/ratings/sp') {
        return {
            isFinal: false,
            ttlMs: 6 * 60 * 60 * 1000
        };
    }

    if (path === '/draft/picks') {
        return {
            isFinal:
                Number.isFinite(requestYear) &&
                requestYear < currentYear,
            ttlMs: 24 * 60 * 60 * 1000
        };
    }

    return {
        isFinal: false,
        ttlMs: 6 * 60 * 60 * 1000
    };
};

export const cfbdGet = async (path, params = {}) => {
    const apiKey = env.CFBD_API_KEY;

    if (!apiKey) {
        throw new Error(
            'CFBD_API_KEY is not configured. Add it to the Vercel environment variables.'
        );
    }

    const url = buildUrl(path, params);
    const cacheKey = url.toString();
    const now = Date.now();

    pruneMemoryCache(now);

    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    if (inFlight.has(cacheKey)) {
        return inFlight.get(cacheKey);
    }

    const policy = archivePolicy(path, params);

    const promise = archivedFetch({
        provider: 'cfbd',
        cacheKey,
        endpoint: path,
        requestMeta: {
            params,
            url: cacheKey
        },
        ttlMs: policy.ttlMs,
        isFinal: policy.isFinal,
        fetcher: () => requestJson(url, apiKey, path)
    })
        .then(result => {
            memoryCache.set(cacheKey, {
                value: result.value,
                expiresAt: Date.now() + MEMORY_CACHE_TTL_MS
            });

            return result.value;
        })
        .finally(() => {
            inFlight.delete(cacheKey);
        });

    inFlight.set(cacheKey, promise);
    return promise;
};
