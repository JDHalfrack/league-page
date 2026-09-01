import { json } from '@sveltejs/kit';
import { leagueID } from '$lib/utils/leagueInfo';

export async function GET() {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueID}`);

    if (!res.ok) {
        return json(
            { error: 'Failed to fetch Sleeper league data' },
            { status: res.status }
        );
    }

    const data = await res.json();
    return json(data);
}
