<script>
    export let rivalry;
    export let playerOne;
    export let playerTwo;
    export let leagueTeamManagers;
    export let tradeHistory = [];
    export let playerOneRecords = null;
    export let playerTwoRecords = null;


    let generating = false;

    let article = null;

    let model = '';

    let writer = '';

    let error = '';

    let lastAutoKey = '';


    /*
        ==================================================
        MANAGER NAME
        ==================================================
    */

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


    /*
        ==================================================
        SCORE A MATCHUP
        ==================================================
    */

    const scoreMatchup = side => {
        if (
            !side ||
            !Array.isArray(
                side.points
            )
        ) {
            return 0;
        }

        return side.points.reduce(
            (total, points) =>
                total +
                (
                    Number(points) ||
                    0
                ),
            0
        );
    };


    /*
        ==================================================
        TURN RAW MATCHUPS INTO SIMPLE GAMES

        Defense-in-depth:
        0-0 games are removed even though
        rivalryMatchups.js now removes them too.
        ==================================================
    */

    const summarizeMatchups =
        matchups => {

        if (
            !Array.isArray(
                matchups
            )
        ) {
            return [];
        }


        return matchups
            .map(game => {
                const sideOne =
                    game
                        .matchup
                        ?.[0];

                const sideTwo =
                    game
                        .matchup
                        ?.[1];


                const managerOneScore =
                    Number(
                        scoreMatchup(
                            sideOne
                        ).toFixed(2)
                    );


                const managerTwoScore =
                    Number(
                        scoreMatchup(
                            sideTwo
                        ).toFixed(2)
                    );


                return {
                    year:
                        Number(
                            game.year
                        ),

                    week:
                        Number(
                            game.week
                        ),

                    playoffRound:
                        game.label ||
                        null,

                    managerOneScore,

                    managerTwoScore,

                    margin:
                        Number(
                            Math.abs(
                                managerOneScore -
                                managerTwoScore
                            ).toFixed(2)
                        ),

                    winner:
                        managerOneScore >
                        managerTwoScore
                            ? 'managerOne'
                            : (
                                managerTwoScore >
                                managerOneScore
                                    ? 'managerTwo'
                                    : 'tie'
                            )
                };
            })
            .filter(
                game =>
                    !(
                        game.managerOneScore ===
                            0 &&
                        game.managerTwoScore ===
                            0
                    )
            );
    };


    /*
        ==================================================
        PERFORMANCE
        ==================================================
    */

    const summarizePerformance =
        record => {

        if (!record) {
            return null;
        }


        const wins =
            Number(
                record.wins || 0
            );

        const losses =
            Number(
                record.losses || 0
            );

        const ties =
            Number(
                record.ties || 0
            );

        const games =
            wins +
            losses +
            ties;


        return {
            wins,
            losses,
            ties,
            games,

            winPercentage:
                games
                    ? Number(
                        (
                            wins /
                            games *
                            100
                        ).toFixed(1)
                    )
                    : null,

            fantasyPointsFor:
                Number(
                    Number(
                        record.fptsFor ||
                        0
                    ).toFixed(2)
                ),

            fantasyPointsAgainst:
                Number(
                    Number(
                        record.fptsAgainst ||
                        0
                    ).toFixed(2)
                )
        };
    };


    /*
        ==================================================
        GAME LABEL
        ==================================================
    */

    const gameLabel = game => {
        if (!game) {
            return null;
        }

        if (
            game.playoffRound
        ) {
            return (
                `${game.year} ` +
                `${game.playoffRound}`
            );
        }

        return (
            `${game.year} ` +
            `Week ${game.week}`
        );
    };


    /*
        ==================================================
        AVERAGE
        ==================================================
    */

    const average = values => {
        if (
            !Array.isArray(values) ||
            !values.length
        ) {
            return null;
        }

        return Number(
            (
                values.reduce(
                    (total, value) =>
                        total +
                        value,
                    0
                ) /
                values.length
            ).toFixed(2)
        );
    };


    /*
        ==================================================
        RECORD FROM GAMES
        ==================================================
    */

    const recordFromGames =
        games => {

        let one = 0;
        let two = 0;
        let ties = 0;

        for (
            const game
            of games
        ) {
            if (
                game.winner ===
                'managerOne'
            ) {
                one++;
            }
            else if (
                game.winner ===
                'managerTwo'
            ) {
                two++;
            }
            else {
                ties++;
            }
        }

        return {
            managerOne:
                one,

            managerTwo:
                two,

            ties
        };
    };


    /*
        ==================================================
        CURRENT STREAK

        Incoming games are newest -> oldest.
        ==================================================
    */

    const getCurrentStreak =
        games => {

        if (
            !games.length
        ) {
            return null;
        }


        const winner =
            games[0].winner;


        if (
            winner ===
            'tie'
        ) {
            return {
                type:
                    'tie',

                length:
                    1
            };
        }


        let length = 0;


        for (
            const game
            of games
        ) {
            if (
                game.winner !==
                winner
            ) {
                break;
            }

            length++;
        }


        return {
            manager:
                winner,

            length
        };
    };


    /*
        ==================================================
        CLOSEST GAME
        ==================================================
    */

    const getClosestGame =
        games => {

        if (
            !games.length
        ) {
            return null;
        }


        const sorted =
            [...games]
                .sort(
                    (a, b) =>
                        a.margin -
                        b.margin
                );


        return sorted[0];
    };


    /*
        ==================================================
        BIGGEST BLOWOUT
        ==================================================
    */

    const getBiggestBlowout =
        games => {

        if (
            !games.length
        ) {
            return null;
        }


        const sorted =
            [...games]
                .sort(
                    (a, b) =>
                        b.margin -
                        a.margin
                );


        return sorted[0];
    };


    /*
        ==================================================
        NEWEST / OLDEST
        ==================================================
    */

    const chronologicalSort =
        games =>
            [...games]
                .sort(
                    (a, b) =>
                        (
                            a.year -
                            b.year
                        ) ||
                        (
                            a.week -
                            b.week
                        )
                );


    /*
        ==================================================
        TURN A GAME INTO A FACT-SHEET OBJECT
        ==================================================
    */

    const detailedGame =
        game => {

        if (!game) {
            return null;
        }


        return {
            label:
                gameLabel(
                    game
                ),

            year:
                game.year,

            week:
                game.week,

            playoffRound:
                game.playoffRound,

            managerOneScore:
                game.managerOneScore,

            managerTwoScore:
                game.managerTwoScore,

            margin:
                game.margin,

            winner:
                game.winner
        };
    };


    /*
        ==================================================
        BUILD FACT SHEET

        This is the analytical layer.

        The AI receives conclusions that the APPLICATION
        has already calculated instead of being asked
        to discover them itself.
        ==================================================
    */

    const buildFactSheet = (
        regularGames,
        playoffGames
    ) => {
        const managerOneName =
            getManagerName(
                playerOne
            );

        const managerTwoName =
            getManagerName(
                playerTwo
            );


        const regularRecord =
            recordFromGames(
                regularGames
            );


        const playoffRecord =
            recordFromGames(
                playoffGames
            );


        const allGames =
            [
                ...regularGames,
                ...playoffGames
            ];


        const allRecord =
            recordFromGames(
                allGames
            );


        const chronologicalRegular =
            chronologicalSort(
                regularGames
            );


        const firstRegular =
            chronologicalRegular[0] ||
            null;


        const latestRegular =
            regularGames[0] ||
            null;


        const recentFive =
            regularGames.slice(
                0,
                5
            );


        const recentFiveRecord =
            recordFromGames(
                recentFive
            );


        const currentStreak =
            getCurrentStreak(
                regularGames
            );


        let streakFact = null;


        if (currentStreak) {
            if (
                currentStreak.type ===
                'tie'
            ) {
                streakFact =
                    'Most recent regular-season meeting was a tie.';
            }
            else {
                const streakName =
                    currentStreak.manager ===
                    'managerOne'
                        ? managerOneName
                        : managerTwoName;

                streakFact =
                    `${streakName} has won the last ${currentStreak.length} regular-season meeting${currentStreak.length === 1 ? '' : 's'}.`;
            }
        }


        const regularAverageOne =
            average(
                regularGames.map(
                    game =>
                        game.managerOneScore
                )
            );


        const regularAverageTwo =
            average(
                regularGames.map(
                    game =>
                        game.managerTwoScore
                )
            );


        const closestRegular =
            getClosestGame(
                regularGames
            );


        const biggestRegular =
            getBiggestBlowout(
                regularGames
            );


        const closestOverall =
            getClosestGame(
                allGames
            );


        const biggestOverall =
            getBiggestBlowout(
                allGames
            );


        return {
            managers: {
                managerOne:
                    managerOneName,

                managerTwo:
                    managerTwoName
            },


            totalMeaningfulMeetings:
                allGames.length,


            regularSeason: {
                meetings:
                    regularGames.length,

                record: {
                    [managerOneName]:
                        regularRecord.managerOne,

                    [managerTwoName]:
                        regularRecord.managerTwo,

                    ties:
                        regularRecord.ties
                },

                averageScore: {
                    [managerOneName]:
                        regularAverageOne,

                    [managerTwoName]:
                        regularAverageTwo
                },

                firstMeeting:
                    detailedGame(
                        firstRegular
                    ),

                mostRecentMeeting:
                    detailedGame(
                        latestRegular
                    ),

                closestGame:
                    detailedGame(
                        closestRegular
                    ),

                biggestBlowout:
                    detailedGame(
                        biggestRegular
                    ),

                currentStreak:
                    streakFact,

                lastFive: {
                    gamesPlayed:
                        recentFive.length,

                    record: {
                        [managerOneName]:
                            recentFiveRecord
                                .managerOne,

                        [managerTwoName]:
                            recentFiveRecord
                                .managerTwo,

                        ties:
                            recentFiveRecord
                                .ties
                    }
                }
            },


            playoffs: {
                definition:
                    'Championship/winners bracket only. Consolation games excluded.',

                meetings:
                    playoffGames.length,

                record: {
                    [managerOneName]:
                        playoffRecord.managerOne,

                    [managerTwoName]:
                        playoffRecord.managerTwo,

                    ties:
                        playoffRecord.ties
                },

                games:
                    playoffGames.map(
                        detailedGame
                    )
            },


            allMeaningfulMeetings: {
                record: {
                    [managerOneName]:
                        allRecord.managerOne,

                    [managerTwoName]:
                        allRecord.managerTwo,

                    ties:
                        allRecord.ties
                },

                closestGame:
                    detailedGame(
                        closestOverall
                    ),

                biggestBlowout:
                    detailedGame(
                        biggestOverall
                    )
            },


            tradeHistory: {
                numberOfTrades:
                    tradeHistory.length,

                seasons:
                    [
                        ...new Set(
                            tradeHistory
                                .map(
                                    trade =>
                                        trade.season
                                )
                                .filter(
                                    Boolean
                                )
                        )
                    ]
            }
        };
    };


    /*
        ==================================================
        BUILD REQUEST PAYLOAD
        ==================================================
    */

    const buildPayload = () => {
        const managerOneName =
            getManagerName(
                playerOne
            );

        const managerTwoName =
            getManagerName(
                playerTwo
            );


        const regularGames =
            summarizeMatchups(
                rivalry
                    ?.regularSeason
                    ?.matchups
            );


        const playoffGames =
            summarizeMatchups(
                rivalry
                    ?.playoffs
                    ?.matchups
            );


        /*
            Recalculate everything from the filtered
            played-game arrays.

            That guarantees a 0-0 game can never leak
            into the article even if some other code
            accidentally supplies one later.
        */
        const regularRecord =
            recordFromGames(
                regularGames
            );


        const playoffRecord =
            recordFromGames(
                playoffGames
            );


        return {
            managerOne:
                managerOneName,

            managerTwo:
                managerTwoName,


            factSheet:
                buildFactSheet(
                    regularGames,
                    playoffGames
                ),


            regularSeason: {
                gamesPlayed:
                    regularGames.length,

                wins: {
                    managerOne:
                        regularRecord
                            .managerOne,

                    managerTwo:
                        regularRecord
                            .managerTwo
                },

                ties:
                    regularRecord.ties,

                totalPoints: {
                    managerOne:
                        Number(
                            regularGames
                                .reduce(
                                    (
                                        total,
                                        game
                                    ) =>
                                        total +
                                        game
                                            .managerOneScore,
                                    0
                                )
                                .toFixed(2)
                        ),

                    managerTwo:
                        Number(
                            regularGames
                                .reduce(
                                    (
                                        total,
                                        game
                                    ) =>
                                        total +
                                        game
                                            .managerTwoScore,
                                    0
                                )
                                .toFixed(2)
                        )
                },

                matchups:
                    regularGames
            },


            playoffs: {
                note:
                    'Championship/winners bracket only. Consolation games excluded.',

                gamesPlayed:
                    playoffGames.length,

                wins: {
                    managerOne:
                        playoffRecord
                            .managerOne,

                    managerTwo:
                        playoffRecord
                            .managerTwo
                },

                ties:
                    playoffRecord.ties,

                totalPoints: {
                    managerOne:
                        Number(
                            playoffGames
                                .reduce(
                                    (
                                        total,
                                        game
                                    ) =>
                                        total +
                                        game
                                            .managerOneScore,
                                    0
                                )
                                .toFixed(2)
                        ),

                    managerTwo:
                        Number(
                            playoffGames
                                .reduce(
                                    (
                                        total,
                                        game
                                    ) =>
                                        total +
                                        game
                                            .managerTwoScore,
                                    0
                                )
                                .toFixed(2)
                        )
                },

                matchups:
                    playoffGames
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
                    'Overall regular-season career performance. These are NOT head-to-head statistics.',

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


    /*
        ==================================================
        GENERATE ARTICLE
        ==================================================
    */

    async function generateWriteup(
        automatic = false
    ) {
        if (
            generating ||
            !rivalry ||
            !playerOne ||
            !playerTwo
        ) {
            return;
        }


        generating = true;

        error = '';


        if (!automatic) {
            /*
                Keep the previous article visible while
                Another Take is being written.
            */
        }
        else {
            article = null;
            model = '';
            writer = '';
        }


        try {
            const response =
                await fetch(
                    '/api/ai/rivalry',
                    {
                        method:
                            'POST',

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


            if (
                !result?.article
                    ?.headline ||
                !Array.isArray(
                    result
                        ?.article
                        ?.paragraphs
                )
            ) {
                throw new Error(
                    'The writer returned an invalid article.'
                );
            }


            article =
                result.article;

            model =
                result.model ||
                '';

            writer =
                result.writer ||
                '';
        }
        catch (err) {
            error =
                err?.message ||
                'Unable to generate a write-up.';
        }
        finally {
            generating = false;
        }
    }


    /*
        ==================================================
        AUTO-GENERATE

        Generate exactly once each time the selected
        manager pair/rivalry changes.
        ==================================================
    */

    $: autoKey =
        (
            rivalry &&
            playerOne &&
            playerTwo
        )
            ? (
                `${playerOne}|` +
                `${playerTwo}|` +
                `${rivalry?.regularSeason?.matchups?.length || 0}|` +
                `${rivalry?.playoffs?.matchups?.length || 0}`
            )
            : '';


    $: if (
        autoKey &&
        autoKey !== lastAutoKey
    ) {
        lastAutoKey =
            autoKey;

        generateWriteup(
            true
        );
    }
</script>


<style>
    .aiWriter {
        width: 97%;
        max-width: 1000px;
        margin: 2em auto;
        box-sizing: border-box;
        border-radius: 20px;
        border:
            1px solid var(--aaa);
        background-color:
            var(--rivalryBack);
        padding: 2em;
    }

    h3 {
        text-align: center;
        font-size: 1.9em;
        margin:
            0 0 0.35em;
    }

    .intro {
        max-width: 650px;
        margin:
            0 auto 1.5em;
        text-align: center;
        color: #888;
        font-size: 0.9em;
    }

    .writing {
        width: 85%;
        max-width: 550px;
        margin:
            2em auto;
        text-align: center;
        color: #888;
        font-style: italic;
    }

    .buttonHolder {
        text-align: center;
        margin-top: 1.75em;
    }

    button {
        border:
            1px solid #888;
        border-radius: 6px;
        background:
            transparent;
        color:
            inherit;
        font:
            inherit;
        padding:
            0.65em 1.4em;
        cursor:
            pointer;
    }

    button:hover:not(
        :disabled
    ) {
        background-color:
            rgba(
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
        margin:
            2em auto 0;
        line-height: 1.65;
    }

    .headline {
        font-size: 1.45em;
        font-weight: 650;
        line-height: 1.25;
        margin:
            0 0 1.2em;
        text-align: center;
    }

    .paragraph {
        margin:
            1em 0;
    }

    .byline {
        margin-top: 1.75em;
        text-align: center;
        font-size: 0.75em;
        color: #999;
    }

    .error {
        text-align: center;
        margin:
            1.5em auto 0;
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

        .headline {
            font-size:
                1.25em;
        }
    }
</style>


<div class="aiWriter">

    <h3>
        AI Rivalry Column
    </h3>


    <div class="intro">
        The league data supplies the facts.
        A rotating AI columnist supplies the take.
    </div>


    {#if generating && !article}

        <div class="writing">
            Writing rivalry column...
        </div>

    {/if}


    {#if error}

        <div class="error">
            {error}
        </div>

    {/if}


    {#if article}

        <div class="article">

            <div class="headline">
                {article.headline}
            </div>


            {#each article.paragraphs as paragraph}

                <div class="paragraph">
                    {paragraph}
                </div>

            {/each}


            {#if writer || model}

                <div class="byline">

                    Written by

                    {#if writer}
                        {writer}
                    {:else}
                        {model}
                    {/if}

                </div>

            {/if}

        </div>

    {/if}


    {#if article}

        <div class="buttonHolder">

            <button
                onclick={() =>
                    generateWriteup(
                        false
                    )
                }
                disabled={generating}
            >

                {#if generating}
                    Writing Another Take...
                {:else}
                    Another Take
                {/if}

            </button>

        </div>

    {:else if error && !generating}

        <div class="buttonHolder">

            <button
                onclick={() =>
                    generateWriteup(
                        false
                    )
                }
            >
                Try Again
            </button>

        </div>

    {/if}

</div>
