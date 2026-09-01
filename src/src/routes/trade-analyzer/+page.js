import {
    loadPlayers
} from '$lib/utils/helperFunctions/players';

import {
    getTradeLineageDiagnostics
} from '$lib/utils/helperFunctions/tradeLineageDiagnostic';


export async function load({
    fetch
}) {
    const [
        diagnostics,
        playersData
    ] =
        await Promise.all([
            getTradeLineageDiagnostics(),

            loadPlayers(
                fetch
            )
        ]);


    return {
        diagnostics,

        playersData
    };
}
