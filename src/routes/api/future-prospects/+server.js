import { json } from '@sveltejs/kit';
import { buildProspectBoard } from '$lib/server/futureProspects';

const currentSeasonYear = () => new Date().getFullYear();

export async function GET({ url, setHeaders }) {
    const currentYear = currentSeasonYear();

    const requestedYear = Number(url.searchParams.get('year'));
    const cutoffYear =
        Number.isInteger(requestedYear) && requestedYear >= 2010 && requestedYear <= currentYear
            ? requestedYear
            : currentYear;

    const requestedWeek = Number(url.searchParams.get('week'));
    const endWeek = Number.isInteger(requestedWeek) && requestedWeek > 0 ? requestedWeek : null;

    try {
        const board = await buildProspectBoard({ cutoffYear, endWeek, currentYear });

        setHeaders({
            'cache-control':
                cutoffYear === currentYear
                    ? 'public, s-maxage=21600, stale-while-revalidate=43200'
                    : 'public, s-maxage=86400, stale-while-revalidate=604800'
        });

        return json(board);
    } catch (err) {
        console.error('Future Prospects CFBD error:', err);

        return json(
            {
                error: true,
                message:
                    err?.message || 'Future Prospects could not load from CollegeFootballData.',
                cutoffYear,
                prospects: []
            },
            { status: 500 }
        );
    }
}
