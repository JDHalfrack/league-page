<script>
    import Matchup from "$lib/Matchups/Matchup.svelte";
    import TradeTransaction from "$lib/Transactions/TradeTransaction.svelte";

    import {
        getLeagueRecords,
        getLeagueTransactions,
        getRivalryMatchups,
        loadPlayers,
        round
    } from "$lib/utils/helper";

    import {
        getRosterIDFromManagerIDAndYear
    } from "$lib/utils/helperFunctions/universalFunctions";

    import LinearProgress from '@smui/linear-progress';
    import { onMount } from "svelte";

    import ComparissonBar from "./ComparissonBar.svelte";
    import ManagerSelectors from "./ManagerSelectors.svelte";
    import RivalryControls from "./RivalryControls.svelte";
    import RivalryWriteup from "./RivalryWriteup.svelte";

    export let leagueTeamManagers;
    export let playersInfo;
    export let transactionsInfo;
    export let recordsInfo;
    export let playerOne;
    export let playerTwo;

    /*
        ============================================
        REFRESH STALE DATA
        ============================================
    */

    onMount(async () => {
        if (transactionsInfo.stale) {
            transactionsInfo =
                await getLeagueTransactions(
                    false,
                    true
                );
        }

        if (playersInfo.stale) {
            playersInfo =
                await loadPlayers(
                    null,
                    true
                );
        }

        if (recordsInfo.stale) {
            recordsInfo =
                await getLeagueRecords(
                    true
                );
        }
    });

    /*
        ============================================
        RIVALRY DATA
        ============================================
    */

    let rivalry = null;
    let loading = true;

    const analyzeRivalry = async (
        p1,
        p2
    ) => {
        loading = true;

        regularSelected = 0;
        playoffSelected = 0;

        if (
            p1 &&
            p2
        ) {
            rivalry =
                await getRivalryMatchups(
                    p1,
                    p2
                );

            loading = false;
        }
        else {
            rivalry = null;
            loading = false;
        }
    };

    $: analyzeRivalry(
        playerOne,
        playerTwo
    );

    /*
        ============================================
        REGULAR-SEASON CAROUSEL
        ============================================
    */

    let regularSelected = 0;

    $: regularMatchup =
        rivalry
            ?.regularSeason
            ?.matchups[
                regularSelected
            ]
            ?.matchup;

    $: regularDisplayWeek =
        rivalry
            ?.regularSeason
            ?.matchups[
                regularSelected
            ]
            ?.week;

    $: regularYear =
        rivalry
            ?.regularSeason
            ?.matchups[
                regularSelected
            ]
            ?.year;

    /*
        ============================================
        PLAYOFF CAROUSEL
        ============================================
    */

    let playoffSelected = 0;

    $: playoffMatchup =
        rivalry
            ?.playoffs
            ?.matchups[
                playoffSelected
            ]
            ?.matchup;

    $: playoffDisplayWeek =
        rivalry
            ?.playoffs
            ?.matchups[
                playoffSelected
            ]
            ?.week;

    $: playoffYear =
        rivalry
            ?.playoffs
            ?.matchups[
                playoffSelected
            ]
            ?.year;

    $: playoffLabel =
        rivalry
            ?.playoffs
            ?.matchups[
                playoffSelected
            ]
            ?.label;

    /*
        ============================================
        TRADE HISTORY
        ============================================
    */

    const setTradeHistory = (
        p1,
        p2
    ) => {
        if (
            !p1 ||
            !p2
        ) {
            return [];
        }

        const trades =
            transactionsInfo
                .transactions
                .filter(
                    transaction => {
                        if (
                            transaction.type !==
                            "trade"
                        ) {
                            return false;
                        }

                        const rosterIDOne =
                            parseInt(
                                getRosterIDFromManagerIDAndYear(
                                    leagueTeamManagers,
                                    playerOne,
                                    transaction.season
                                )
                            );

                        const rosterIDTwo =
                            parseInt(
                                getRosterIDFromManagerIDAndYear(
                                    leagueTeamManagers,
                                    playerTwo,
                                    transaction.season
                                )
                            );

                        if (
                            rosterIDOne ==
                            rosterIDTwo
                        ) {
                            return false;
                        }

                        return (
                            transaction.rosters.includes(
                                rosterIDOne
                            ) &&
                            transaction.rosters.includes(
                                rosterIDTwo
                            )
                        );
                    }
                );

        const move = (
            arr,
            from,
            to
        ) => {
            arr.splice(
                to,
                0,
                arr.splice(
                    from,
                    1
                )[0]
            );
        };

        /*
            Reorganize trades so they match the
            left/right alignment of the rivalry page.
        */
        return trades.map(t => {
            const rosterIDOne =
                parseInt(
                    getRosterIDFromManagerIDAndYear(
                        leagueTeamManagers,
                        playerOne,
                        t.season
                    )
                );

            const rosterIDTwo =
                parseInt(
                    getRosterIDFromManagerIDAndYear(
                        leagueTeamManagers,
                        playerTwo,
                        t.season
                    )
                );

            const rosterOneStartLocation =
                t.rosters.indexOf(
                    rosterIDOne
                );

            if (
                rosterOneStartLocation >
                0
            ) {
                move(
                    t.rosters,
                    rosterOneStartLocation,
                    0
                );

                for (
                    const tradeMove
                    of t.moves
                ) {
                    move(
                        tradeMove,
                        rosterOneStartLocation,
                        0
                    );
                }
            }

            const rosterTwoStartLocation =
                t.rosters.indexOf(
                    rosterIDTwo
                );

            const last =
                t.rosters.length - 1;

            if (
                rosterTwoStartLocation <
                last
            ) {
                move(
                    t.rosters,
                    rosterTwoStartLocation,
                    last
                );

                for (
                    const tradeMove
                    of t.moves
                ) {
                    move(
                        tradeMove,
                        rosterTwoStartLocation,
                        last
                    );
                }
            }

            return t;
        });
    };

    $: tradeHistory =
        setTradeHistory(
            playerOne,
            playerTwo
        );

    /*
        ============================================
        PERFORMANCE COMPARISON
        ============================================
    */

    const performanceOrderOne = [
        {
            field: "wins",
            label: "Wins",
            unit: "wins"
        },
        {
            field: "losses",
            label: "Losses",
            unit: "losses"
        },
        {
            field: "ties",
            label: "Ties",
            unit: "ties"
        }
    ];

    const performanceOrderTwo = [
        {
            field: "fptsFor",
            label:
                "Fantasy Points For",
            unit: "fpts"
        },
        {
            field:
                "fptsAgainst",
            label:
                "Fantasy Points Against",
            unit:
                "fpts against"
        }
    ];

    $: playerOneRecords =
        recordsInfo
            ?.regularSeasonData
            ?.leagueManagerRecords
            ? recordsInfo
                .regularSeasonData
                .leagueManagerRecords[
                    playerOne
                ]
            : null;

    $: playerTwoRecords =
        recordsInfo
            ?.regularSeasonData
            ?.leagueManagerRecords
            ? recordsInfo
                .regularSeasonData
                .leagueManagerRecords[
                    playerTwo
                ]
            : null;
</script>


<style>
    .scoreBoard {
        width: 97%;
        border-radius: 20px;
        background-color:
            var(--rivalryBack);
        border:
            1px solid var(--aaa);
        margin:
            2em auto;
        padding:
            2em 0;
        max-width:
            1000px;
    }

    h2 {
        text-align:
            center;
        font-size:
            2.4em;
        margin:
            1.3em 0 0;
    }

    h3 {
        text-align:
            center;
        font-size:
            1.9em;
        margin:
            20px 0 16px;
    }

    .sectionSub {
        text-align:
            center;
        font-size:
            0.9em;
        color:
            var(--g777);
        margin:
            -5px auto 20px;
    }

    .trades {
        width:
            95%;
        max-width:
            750px;
        margin:
            2em auto;
    }

    .loading {
        display:
            block;
        width:
            85%;
        max-width:
            500px;
        margin:
            80px auto;
    }

    .center {
        text-align:
            center;
    }

    .helmets {
        width:
            80%;
        max-width:
            800px;
        margin:
            0 auto 2em;
    }

    .noPlayoffs {
        text-align:
            center;
        color:
            var(--g777);
        font-style:
            italic;
        margin:
            2em 1em;
    }

    @media (
        max-width: 650px
    ) {
        h3 {
            font-size:
                1.6em;
        }
    }

    @media (
        max-width: 400px
    ) {
        h2 {
            font-size:
                2em;
        }

        h3 {
            font-size:
                1.3em;
        }
    }
</style>


<h2>
    Rivalry
</h2>


<div class="rivalrySelection">

    <ManagerSelectors
        bind:playerOne={playerOne}
        bind:playerTwo={playerTwo}
        {leagueTeamManagers}
    />

</div>


{#if loading}

    {#if playerOne && playerTwo}

        <div class="loading">

            <p>
                Analyzing rivalry...
            </p>

            <br />

            <LinearProgress
                indeterminate
            />

        </div>

    {:else}

        <div class="center">

            <img
                class="helmets"
                src="/helmets.png"
                alt="placeholder of helmets clashing"
            />

        </div>

    {/if}


{:else}


    {#if playerOne && playerTwo}

        <!-- =====================================
             AI RIVALRY WRITE-UP
             ===================================== -->

        <RivalryWriteup
            {rivalry}
            {playerOne}
            {playerTwo}
            {leagueTeamManagers}
            {tradeHistory}
            {playerOneRecords}
            {playerTwoRecords}
        />


        <!-- =====================================
             REGULAR SEASON
             ===================================== -->

        <div class="scoreBoard">

            <h3>
                Regular Season Head to Head
            </h3>


            {#if rivalry?.regularSeason?.matchups?.length > 0}

                <ComparissonBar
                    sideOne={rivalry.regularSeason.wins.one}
                    sideTwo={rivalry.regularSeason.wins.two}
                    label="Wins"
                    unit="wins"
                />


                <ComparissonBar
                    sideOne={parseFloat(
                        round(
                            rivalry.regularSeason.points.one
                        )
                    )}
                    sideTwo={parseFloat(
                        round(
                            rivalry.regularSeason.points.two
                        )
                    )}
                    label="Points"
                    unit="pts"
                />


                <h3>
                    Regular Season Matchups
                </h3>


                <RivalryControls
                    bind:selected={regularSelected}
                    year={regularYear}
                    displayWeek={regularDisplayWeek}
                    length={rivalry.regularSeason.matchups.length}
                />


                <Matchup
                    key={`${playerOne}-${playerTwo}-regular`}
                    ix={regularSelected}
                    active={regularSelected}
                    year={regularYear}
                    matchup={regularMatchup}
                    players={playersInfo.players}
                    displayWeek={regularDisplayWeek}
                    expandOverride={true}
                    {leagueTeamManagers}
                />

            {:else}

                <div class="noPlayoffs">
                    No regular-season meetings found.
                </div>

            {/if}

        </div>


        <!-- =====================================
             WINNERS-BRACKET PLAYOFFS
             ===================================== -->

        <div class="scoreBoard">

            <h3>
                Playoff Head to Head
            </h3>

            <div class="sectionSub">
                Championship bracket games only
            </div>


            {#if rivalry?.playoffs?.matchups?.length > 0}

                <ComparissonBar
                    sideOne={rivalry.playoffs.wins.one}
                    sideTwo={rivalry.playoffs.wins.two}
                    label="Wins"
                    unit="wins"
                />


                <ComparissonBar
                    sideOne={parseFloat(
                        round(
                            rivalry.playoffs.points.one
                        )
                    )}
                    sideTwo={parseFloat(
                        round(
                            rivalry.playoffs.points.two
                        )
                    )}
                    label="Points"
                    unit="pts"
                />


                <h3>
                    Playoff Matchups
                </h3>


                <RivalryControls
                    bind:selected={playoffSelected}
                    year={playoffYear}
                    displayWeek={playoffDisplayWeek}
                    label={playoffLabel}
                    length={rivalry.playoffs.matchups.length}
                />


                <Matchup
                    key={`${playerOne}-${playerTwo}-playoffs`}
                    ix={playoffSelected}
                    active={playoffSelected}
                    year={playoffYear}
                    matchup={playoffMatchup}
                    players={playersInfo.players}
                    displayWeek={playoffDisplayWeek}
                    expandOverride={true}
                    {leagueTeamManagers}
                />

            {:else}

                <div class="noPlayoffs">
                    No championship-bracket playoff meetings.
                </div>

            {/if}

        </div>


        <!-- =====================================
             TRADE HISTORY
             ===================================== -->

        <div class="scoreBoard">

            <h3>
                Trade History
            </h3>


            <div class="trades">

                {#each tradeHistory as transaction}

                    <TradeTransaction
                        players={playersInfo.players}
                        {transaction}
                        {leagueTeamManagers}
                    />

                {:else}

                    No trades yet...

                {/each}

            </div>

        </div>


        <!-- =====================================
             REGULAR-SEASON PERFORMANCE
             ===================================== -->

        {#if playerOneRecords && playerTwoRecords}

            <div class="scoreBoard">

                <h3>
                    Regular Season Performance Comparison
                </h3>


                <ComparissonBar
                    sideOne={parseFloat(
                        round(
                            playerOneRecords.wins /
                            (
                                playerOneRecords.wins +
                                playerOneRecords.ties +
                                playerOneRecords.losses
                            ) *
                            100
                        )
                    )}
                    sideTwo={parseFloat(
                        round(
                            playerTwoRecords.wins /
                            (
                                playerTwoRecords.wins +
                                playerTwoRecords.ties +
                                playerTwoRecords.losses
                            ) *
                            100
                        )
                    )}
                    label="Win Percentage"
                    unit="%"
                />


                {#each performanceOrderOne as stat}

                    <ComparissonBar
                        sideOne={parseFloat(
                            round(
                                playerOneRecords[
                                    stat.field
                                ]
                            )
                        )}
                        sideTwo={parseFloat(
                            round(
                                playerTwoRecords[
                                    stat.field
                                ]
                            )
                        )}
                        label={stat.label}
                        unit={stat.unit}
                    />

                {/each}


                <ComparissonBar
                    sideOne={parseFloat(
                        round(
                            playerOneRecords.fptsFor /
                            (
                                playerOneRecords.wins +
                                playerOneRecords.ties +
                                playerOneRecords.losses
                            )
                        )
                    )}
                    sideTwo={parseFloat(
                        round(
                            playerTwoRecords.fptsFor /
                            (
                                playerTwoRecords.wins +
                                playerTwoRecords.ties +
                                playerTwoRecords.losses
                            )
                        )
                    )}
                    label="Fantasy Points per Game"
                    unit="fpts/game"
                />


                {#each performanceOrderTwo as stat}

                    <ComparissonBar
                        sideOne={parseFloat(
                            round(
                                playerOneRecords[
                                    stat.field
                                ]
                            )
                        )}
                        sideTwo={parseFloat(
                            round(
                                playerTwoRecords[
                                    stat.field
                                ]
                            )
                        )}
                        label={stat.label}
                        unit={stat.unit}
                    />

                {/each}


                <ComparissonBar
                    sideOne={parseFloat(
                        round(
                            playerOneRecords.fptsFor /
                            playerOneRecords.potentialPoints *
                            100
                        )
                    )}
                    sideTwo={parseFloat(
                        round(
                            playerTwoRecords.fptsFor /
                            playerTwoRecords.potentialPoints *
                            100
                        )
                    )}
                    label="Lineup IQ"
                    unit="%"
                />

            </div>

        {/if}


    {/if}


{/if}
