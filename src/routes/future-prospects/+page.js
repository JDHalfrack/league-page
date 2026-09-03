export async function load({ fetch, url }) {
    const prospectClass = url.searchParams.get('class');
    const legacyYear = url.searchParams.get('year');
    const week = url.searchParams.get('week');

    const params = new URLSearchParams();

    if (prospectClass) {
        params.set('class', prospectClass);
    } else if (legacyYear) {
        // Keep old shared/bookmarked URLs working.
        params.set('year', legacyYear);
    }

    if (week) params.set('week', week);

    const response = await fetch(
        `/api/future-prospects${params.size ? `?${params.toString()}` : ''}`
    );

    const board = await response.json();

    return { board };
}
