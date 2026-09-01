<script>
    export let rivalry;
    export let playerOne;
    export let playerTwo;
    export let leagueTeamManagers;
    export let tradeHistory = [];
    export let playerOneRecords = null;
    export let playerTwoRecords = null;

    let generating = false;
    let writeup = '';
    let model = '';
    let error = '';

    const getManagerName = id => {
        const user =
            leagueTeamManagers
                ?.users
                ?.[id];

        return (
            user?.display_name ||
            user?.user_name ||
            'Unknown Manager'
        );
    };

    const scoreMatchup = side => {
        if (
            !side ||
            !Array.isArray(side.points)
        ) {
            return 0;
        }

        return side.points.reduce(
            (total, points) =>
                total +
                (Number(points) || 0),
            0
        );
    };

    const summarizeMatchups =
        matchups => {

        if (
            !Array.isArray(matchups)
        ) {
            return [];
        }

        return matchups.map(game => {
            const sideOne =
                game.matchup?.[0];

            const sideTwo =
                game.matchup?.[1];

            return {
                year:
                    game.year,

                week:
                    game.week,

                playoffRound:
                    game.label || null,

                managerOneScore:
                    Number(
                        scoreMatchup(
                            sideOne
                        ).toFixed(2)
                    ),

                managerTwoScore:
                    Number(
                        scoreMatchup(
                            sideTwo
                        ).toFixed(2)
                    )
            };
        });
    };

    const summarizePerformance =
        record => {

        if (!record) {
            return null;
        }

        const games =
            (record.wins || 0) +
            (record.losses || 0) +
            (record.ties || 0);

        return {
            wins:
                record.wins || 0,

            losses:
                record.losses || 0,

            ties:
                record.ties || 0,

            fantasyPointsFor:
                Number(
                    (
                        record.fptsFor ||
                        0
                    ).toFixed?.(2) ??
                    record.fptsFor ??
                    0
                ),

            fantasyPointsAgainst:
                Number(
                    (
                        record.fptsAgainst ||
                        0
                    ).toFixed?.(2) ??
                    record.fptsAgainst ??
                    0
                ),

            games
        };
    };

    const buildPayload = () => {
        return {
            managerOne:
                getManagerName(
                    playerOne
                ),

            managerTwo:
                getManagerName(
                    playerTwo
                ),

            regularSeason: {
                wins: {
                    managerOne:
                        rivalry
                            ?.regularSeason
                            ?.wins
                            ?.one ?? 0,

                    managerTwo:
                        rivalry
                            ?.regularSeason
                            ?.wins
                            ?.two ?? 0
                },

                ties:
                    rivalry
                        ?.regularSeason
                        ?.ties ?? 0,

                totalPoints: {
                    managerOne:
                        Number(
                            (
                                rivalry
                                    ?.regularSeason
                                    ?.points
                                    ?.one ??
                                0
                            ).toFixed(2)
                        ),

                    managerTwo:
                        Number(
                            (
                                rivalry
                                    ?.regularSeason
                                    ?.points
                                    ?.two ??
                                0
                            ).toFixed(2)
                        )
                },

                matchups:
                    summarizeMatchups(
                        rivalry
                            ?.regularSeason
                            ?.matchups
                    )
            },

            playoffs: {
                note:
                    'Championship/winners bracket only.',

                wins: {
                    managerOne:
                        rivalry
                            ?.playoffs
                            ?.wins
                            ?.one ?? 0,

                    managerTwo:
                        rivalry
                            ?.playoffs
                            ?.wins
                            ?.two ?? 0
                },

                ties:
                    rivalry
                        ?.playoffs
                        ?.ties ?? 0,

                totalPoints: {
                    managerOne:
                        Number(
                            (
                                rivalry
                                    ?.playoffs
                                    ?.points
                                    ?.one ??
                                0
                            ).toFixed(2)
                        ),

                    managerTwo:
                        Number(
                            (
                                rivalry
                                    ?.playoffs
                                    ?.points
                                    ?.two ??
                                0
                            ).toFixed(2)
                        )
                },

                matchups:
                    summarizeMatchups(
                        rivalry
                            ?.playoffs
                            ?.matchups
                    )
            },

            trades: {
                totalTrades:
                    tradeHistory.length,

                seasons:
                    tradeHistory
                        .map(
                            trade =>
                                trade.season
                        )
                        .filter(Boolean)
            },

            performance: {
                note:
                    'These are overall regular-season career statistics, not head-to-head statistics.',

                managerOne:
                    summarizePerformance(
                        playerOneRecords
                    ),

                managerTwo:
                    summarizePerformance(
                        playerTwoRecords
                    )
            }
        };
    };

    const generateWriteup =
        async () => {

        if (
            generating ||
            !rivalry
        ) {
            return;
        }

        generating = true;
        error = '';

        try {
            const response =
                await fetch(
                    '/api/ai/rivalry',
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify(
                                buildPayload()
                            )
                    }
                );

            const result =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    result?.error ||
                    'Unable to generate a write-up.'
                );
            }

            writeup =
                result.writeup;

            model =
                result.model || '';
        }
        catch (err) {
            error =
                err?.message ||
                'Unable to generate a write-up.';
        }
        finally {
            generating = false;
        }
    };

    const paragraphs = text =>
        text
            .split(/\n+/)
            .map(
                paragraph =>
                    paragraph.trim()
            )
            .filter(Boolean);
</script>

<style>
    .aiWriter {
        width: 97%;
        max-width: 1000px;
        margin: 2em auto;
        box-sizing: border-box;
        border-radius: 20px;
        border: 1px solid var(--aaa);
        background-color: var(--rivalryBack);
        padding: 2em;
    }

    h3 {
        text-align: center;
        font-size: 1.9em;
        margin: 0 0 0.35em;
    }

    .intro {
        max-width: 650px;
        margin: 0 auto 1.5em;
        text-align: center;
        color: #888;
        font-size: 0.9em;
    }

    .buttonHolder {
        text-align: center;
    }

    button {
        border: 1px solid #888;
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
        padding: 0.65em 1.4em;
        cursor: pointer;
    }

    button:hover:not(:disabled) {
        background-color: rgba(
            127,
            127,
            127,
            0.1
        );
    }

    button:disabled {
        opacity: 0.55;
        cursor: default;
    }

    .article {
        max-width: 760px;
        margin: 2em auto 0;
        line-height: 1.65;
    }

    .headline {
        font-size: 1.35em;
        font-weight: 600;
        line-height: 1.25;
        margin: 0 0 1em;
        text-align: center;
    }

    .paragraph {
        margin: 1em 0;
    }

    .byline {
        margin-top: 1.75em;
        text-align: center;
        font-size: 0.75em;
        color: #999;
    }

    .error {
        text-align: center;
        margin: 1.5em auto 0;
        color: #c55;
    }

    @media (
        max-width: 650px
    ) {
        .aiWriter {
            padding:
                1.5em 1em;
        }

        h3 {
            font-size:
                1.6em;
        }
    }
</style>

<div class="aiWriter">

    <h3>
        AI Rivalry Column
    </h3>

    <div class="intro">
        A different free AI writer may
        get the assignment each time.
        The statistics stay the same;
        the columnist may not.
    </div>

    <div class="buttonHolder">

        <button
            onclick={generateWriteup}
            disabled={generating}
        >
            {#if generating}
                Writing...
            {:else if writeup}
                Generate Another Take
            {:else}
                Generate a Take
            {/if}
        </button>

    </div>

    {#if error}

        <div class="error">
            {error}
        </div>

    {/if}

    {#if writeup}

        {@const parts =
            paragraphs(writeup)}

        <div class="article">

            {#if parts.length}

                <div class="headline">
                    {parts[0]}
                </div>

                {#each parts.slice(1) as paragraph}

                    <div class="paragraph">
                        {paragraph}
                    </div>

                {/each}

            {/if}

            {#if model}

                <div class="byline">
                    This take was written by
                    {model}
                </div>

            {/if}

        </div>

    {/if}

</div>
