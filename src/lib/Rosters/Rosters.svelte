<script>
    import { loadPlayers } from '$lib/utils/helper';
    import { calculateTeamWindowScores } from '$lib/utils/helperFunctions/teamWindowScores';
    import RosterSorter from './RosterSorter.svelte';

    export let leagueData;
    export let rosterData;
    export let leagueTeamManagers;
    export let playersInfo;
    export let nflState;

    let players = playersInfo.players;

    $: teamScores = calculateTeamWindowScores({
        rostersData: rosterData,
        players,
        leagueData,
        currentWeek: nflState?.week || 1
    });

    const refreshPlayers = async () => {
        const newPlayersInfo = await loadPlayers(null, true);

        players = newPlayersInfo.players;
    };

    if (playersInfo.stale) {
        refreshPlayers();
    }
</script>

<style>
    .rosters {
        position: relative;
        z-index: 1;
    }
</style>

<div class="rosters">
    <RosterSorter
        rosters={rosterData.rosters}
        {players}
        {leagueTeamManagers}
        startersAndReserve={rosterData.startersAndReserve}
        {leagueData}
        {teamScores}
    />
</div>
