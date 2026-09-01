import { getLeagueTeamManagers } from '$lib/utils/helper';
import { buildManagers } from '$lib/utils/helperFunctions/autoManagers';

export async function load() {
    const leagueTeamManagers = await getLeagueTeamManagers();
    const managers = buildManagers(leagueTeamManagers);

    return {
        managers,
        leagueTeamManagersData: Promise.resolve(leagueTeamManagers)
    };
}
