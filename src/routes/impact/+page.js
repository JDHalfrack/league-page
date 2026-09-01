import {
    getHistoricallyImpactfulGames
} from '$lib/utils/helperFunctions/historicalImpact';


export async function load() {
    const impactInfo =
        getHistoricallyImpactfulGames();


    return {
        impactInfo
    };
}
