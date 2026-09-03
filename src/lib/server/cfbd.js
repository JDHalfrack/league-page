import { env } from '$env/dynamic/private';

const BASE_URL = 'https://api.collegefootballdata.com';

const buildUrl = (path, params = {}) => {
    const url = new URL(`${BASE_URL}${path}`);

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
    }

    return url;
};

export const cfbdGet = async (path, params = {}) => {
    const apiKey = env.CFBD_API_KEY;

    if (!apiKey) {
        throw new Error(
            'CFBD_API_KEY is not configured. Add it to the Vercel environment variables.'
        );
    }

    const response = await fetch(buildUrl(path, params), {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json'
        }
    });

    if (!response.ok) {
        let detail = '';
        try {
            detail = await response.text();
        } catch {
            detail = '';
        }

        throw new Error(
            `CFBD ${path} failed with ${response.status}${
                detail ? `: ${detail.slice(0, 300)}` : ''
            }`
        );
    }

    return response.json();
};
