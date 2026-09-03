export async function load({ fetch, url }) {
    const year = url.searchParams.get('year');
    const week = url.searchParams.get('week');

    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (week) params.set('week', week);

    const response = await fetch(
        `/api/future-prospects${params.size ? `?${params.toString()}` : ''}`
    );

    const board = await response.json();

    return { board };
}
