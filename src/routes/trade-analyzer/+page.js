import {
    loadPlayers
} from '$lib/utils/helperFunctions/players';

import {
    getTradeLineageDiagnostics
} from '$lib/utils/helperFunctions/tradeLineageDiagnostic';


export async function load({
    fetch
}) {
    /*
        Phase 5 needs player position metadata before it can
        normalize each historical ownership stint.
    */

    const playersData =
        await loadPlayers(
            fetch
        );


    const diagnostics =
        await getTradeLineageDiagnostics(
            playersData
                ?.players ||
            {}
        );


    return {
        diagnostics,

        playersData
    };
}
