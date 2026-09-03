import { json } from '@sveltejs/kit';
import { buildProspectBoard } from '$lib/server/futureProspects';

const currentSeasonYear = () => new Date().getFullYear();

export async function GET({ url, setHeaders }) {
    const currentYear = currentSeasonYear();
    const defaultProspectClass = currentYear + 1;

    const requestedClass = Number(url.searchParams.get('class'));
    const legacyRequestedYear = Number(url.searchParams.get('year'));

    let prospectClass = defaultProspectClass;

    if (
        Number.isInteger(requestedClass) &&
        requestedClass >= 2011 &&
        requestedClass <= currentYear + 1
    ) {
        prospectClass = requestedClass;
    } else if (
        Number.isInteger(legacyRequestedYear) &&
        legacyRequestedYear >= 2010 &&
        legacyRequestedYear <= currentYear
    ) {
        prospectClass = legacyRequestedYear + 1;
    }

    const cutoffYear = prospectClass - 1;

    const requestedWeek = Number(url.searchParams.get('week'));
    const endWeek =
        Number.isInteger(requestedWeek) && requestedWeek > 0
            ? requestedWeek
            : null;

    try {
        const board = await buildProspectBoard({
            prospectClass,
            cutoffYear,
            endWeek,
            currentYear
        });

        setHeaders({
            'cache-control':
                prospectClass === defaultProspectClass
                    ? 'public, s-maxage=21600, stale-while-revalidate=86400'
                    : 'public, s-maxage=604800, stale-while-revalidate=2592000'
        });

        return json(board);
    } catch (err) {
        console.error('Future Prospects CFBD error:', err);

        return json(
            {
                error: true,
                message:
                    err?.message ||
                    'Future Prospects could not load from CollegeFootballData.',
                prospectClass,
                cutoffYear,
                prospects: []
            },
            { status: 500 }
        );
    }
}
