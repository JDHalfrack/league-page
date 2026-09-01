import {
    waitForAll,
    getLeagueRosters,
    getLeagueTeamManagers,
    getLeagueData,
    getLeagueTransactions,
    getAwards,
    getLeagueRecords
} from '$lib/utils/helper';

import { buildManagers } from '$lib/utils/helperFunctions/autoManagers';

export async function load({ url }) {
    const leagueTeamManagers = await getLeagueTeamManagers();
    const managersObj = buildManagers(leagueTeamManagers);

    const managersInfo = waitForAll(
        getLeagueRosters(),
        Promise.resolve(leagueTeamManagers),
        getLeagueData(),
        getLeagueTransactions(),
        getAwards(),
        getLeagueRecords()
    );

    const manager = url?.searchParams?.get('manager');

    return {
        manager:
            manager !== null &&
            Number(manager) >= 0 &&
            Number(manager) < managersObj.length
                ? Number(manager)
                : -1,

        managers: managersObj,
        managersInfo
    };
}
