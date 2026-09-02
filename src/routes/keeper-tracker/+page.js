import {
    loadPlayers
} from '$lib/utils/helperFunctions/players';

import {
    getKeeperTracker
} from '$lib/utils/helperFunctions/keeperTracker';


export async function load({
    fetch
}) {
    const playersData =
        await loadPlayers(
            fetch
        );

    const tracker =
        await getKeeperTracker(
            playersData
                ?.players ||
            {}
        );

    return {
        tracker,
        playersData
    };
}
