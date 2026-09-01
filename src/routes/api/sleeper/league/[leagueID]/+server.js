import { json } from '@sveltejs/kit';

export async function GET({ params }) {
    const { leagueID } = params;

    const res = await fetch(
        `https://api.sleeper.app/v1/league/${leagueID}`
    );

    if (!res.ok) {
        return json(
            {
                error: 'Failed to fetch Sleeper league data',
                leagueID
            },
            { status: res.status }
        );
    }

    return json(await res.json());
}
