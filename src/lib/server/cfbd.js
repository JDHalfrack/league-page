import { env } from '$env/dynamic/private';

const BASE_URL = 'https://api.collegefootballdata.com';
const MAX_RETRIES = 4;

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

export const cfbdGet = async (path, params = {}) => {
    const apiKey = env.CFBD_API_KEY;

    if (!apiKey) {
        throw new Error(
            'CFBD_API_KEY is not configured. Add it to the Vercel environment variables.'
        );
    }

    const url = buildUrl(path, params);

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
