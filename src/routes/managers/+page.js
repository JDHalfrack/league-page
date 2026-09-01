import {
    getLeagueTeamManagers,
    getLeagueRosters,
    getLeagueData,
    getNflState,
    loadPlayers,
    waitForAll
} from '$lib/utils/helper';

import { buildManagers } from '$lib/utils/helperFunctions/autoManagers';
import { calculateTeamWindowScores } from '$lib/utils/helperFunctions/teamWindowScores';
import { getRosterIDFromManagerID } from '$lib/utils/helperFunctions/universalFunctions';

export async function load({ fetch }) {
    const [
        leagueTeamManagers,
        rostersData,
        leagueData,
        nflState,
        playersInfo
    ] = await waitForAll(
        getLeagueTeamManagers(),
        getLeagueRosters(),
        getLeagueData(),
        getNflState(),
        loadPlayers(fetch)
    );

    const teamScores = calculateTeamWindowScores({
        rostersData,
        players: playersInfo.players,
        leagueData,
        currentWeek: nflState.week || 1
    });

    const managers = buildManagers(leagueTeamManagers).map(manager => {
        const rosterInfo = manager.managerID
            ? getRosterIDFromManagerID(
                leagueTeamManagers,
                manager.managerID
            )
            : null;

        const rosterID = rosterInfo?.rosterID;

        return {
            ...manager,
            windowScores: rosterID
                ? teamScores[rosterID] ?? null
                : null
        };
    });

    return {
        managers,
        leagueTeamManagersData: Promise.resolve(leagueTeamManagers)
    };
}
