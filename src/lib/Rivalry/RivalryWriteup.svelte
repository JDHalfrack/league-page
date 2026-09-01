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
        SCORE ONE SIDE
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
        SIMPLIFY MATCHUPS

        0-0 games are discarded here as an extra layer
        of protection.
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
                record.wins ||
                0
            );

        const losses =
            Number(
                record.losses ||
                0
            );

        const ties =
            Number(
                record.ties ||
                0
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
            !Array.isArray(
                values
            ) ||
            !values.length
        ) {
            return null;
        }


        return Number(
            (
                values.reduce(
                    (
                        total,
                        value
                    ) =>
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
        RECORD
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
        CURRENT REGULAR-SEASON STREAK

        Games are newest -> oldest.
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


        return [...games]
            .sort(
                (a, b) =>
                    a.margin -
                    b.margin
            )[0];
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


        return [...games]
            .sort(
                (a, b) =>
                    b.margin -
                    a.margin
            )[0];
    };


    /*
        ==================================================
        CHRONOLOGICAL SORT
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
        DETAILED GAME
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
        FACT SHEET
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


        let streakFact =
            null;


        if (currentStreak) {
            if (
                currentStreak.type ===
                    'tie'
            ) {
                streakFact =
                    'The most recent regular-season meeting was a tie.';
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
                        regularRecord
                            .managerOne,

                    [managerTwoName]:
                        regularRecord
                            .managerTwo,

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
                        playoffRecord
                            .managerOne,

                    [managerTwoName]:
                        playoffRecord
                            .managerTwo,

                    ties:
                        playoffRecord
                            .ties
                },

                games:
                    playoffGames.map(
                        detailedGame
                    )
            },


            allMeaningfulMeetings: {
                record: {
                    [managerOneName]:
                        allRecord
                            .managerOne,

                    [managerTwoName]:
                        allRecord
                            .managerTwo,

                    ties:
                        allRecord
                            .ties
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
        REQUEST PAYLOAD
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
                    regularRecord
                        .ties,

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
                    playoffRecord
                        .ties,

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
        GENERATE
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


        /*
            On the initial automatic generation there
            isn't an old article to preserve.

            For Another Take, leave the current article
            visible until its replacement is ready.
        */
        if (automatic) {
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
                    'Unable to generate a rivalry column.'
                );
            }


            if (
                !result
                    ?.article
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


            /*
                IMPORTANT:
                Store ALL returned paragraphs.

                No slicing.
                No maximum article length.
            */
            article = {
                headline:
                    result
                        .article
                        .headline,

                paragraphs:
                    result
                        .article
                        .paragraphs
            };


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
                'Unable to generate a rivalry column.';
        }
        finally {
            generating =
                false;
        }
    }


    /*
        ==================================================
        AUTOMATIC FIRST ARTICLE
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
        autoKey !==
            lastAutoKey
    ) {
        lastAutoKey =
            autoKey;

        generateWriteup(
            true
        );
    }
</script>


<style>
    /*
        ==================================================
        OUTER ARTICLE CARD

        Explicitly dynamic height.

        Nothing in this component may clip the article.
        ==================================================
    */

    .aiWriter {
        display: block;

        width:
            97%;

        max-width:
            1000px;

        min-height:
            0;

        height:
            auto;

        max-height:
            none;

        overflow:
            visible;

        box-sizing:
            border-box;

        margin:
            2em auto;

        padding:
            2em;

        border-radius:
            20px;

        border:
            1px solid var(--aaa);

        background-color:
            var(--rivalryBack);
    }


    h3 {
        text-align:
            center;

        font-size:
            1.9em;

        margin:
            0 0 0.35em;
    }


    .intro {
        max-width:
            650px;

        height:
            auto;

        max-height:
            none;

        overflow:
            visible;

        margin:
            0 auto 1.5em;

        text-align:
            center;

        color:
            #888;

        font-size:
            0.9em;
    }


    /*
        ==================================================
        INITIAL GENERATION MESSAGE
        ==================================================
    */

    .writing {
        width:
            85%;

        max-width:
            550px;

        height:
            auto;

        margin:
            2em auto;

        text-align:
            center;

        color:
            #888;

        font-style:
            italic;
    }


    /*
        ==================================================
        ARTICLE

        No fixed height.
        No max-height.
        No overflow clipping.
        ==================================================
    */

    .article {
        display:
            block;

        width:
            100%;

        max-width:
            800px;

        min-height:
            0;

        height:
            auto;

        max-height:
            none;

        overflow:
            visible;

        box-sizing:
            border-box;

        margin:
            2em auto 0;

        padding:
            0 0.25em;

        line-height:
            1.7;

        white-space:
            normal;
    }


    .headline {
        display:
            block;

        width:
            100%;

        height:
            auto;

        max-height:
            none;

        overflow:
            visible;

        box-sizing:
            border-box;

        font-size:
            1.5em;

        font-weight:
            650;

        line-height:
            1.3;

        margin:
            0 0 1.3em;

        text-align:
            center;

        white-space:
            normal;

        overflow-wrap:
            anywhere;
    }


    .paragraph {
        display:
            block;

        width:
            100%;

        min-height:
            0;

        height:
            auto;

        max-height:
            none;

        overflow:
            visible;

        box-sizing:
            border-box;

        margin:
            0 0 1.25em;

        white-space:
            normal;

        overflow-wrap:
            break-word;
    }


    .paragraph:last-child {
        margin-bottom:
            0;
    }


    .byline {
        display:
            block;

        height:
            auto;

        max-height:
            none;

        overflow:
            visible;

        margin-top:
            1.75em;

        text-align:
            center;

        font-size:
            0.75em;

        color:
            #999;
    }


    /*
        ==================================================
        BUTTON
        ==================================================
    */

    .buttonHolder {
        display:
            block;

        height:
            auto;

        margin-top:
            1.75em;

        text-align:
            center;
    }


    button {
        border:
            1px solid #888;

        border-radius:
            6px;

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
        opacity:
            0.55;

        cursor:
            default;
    }


    /*
        ==================================================
        ERROR
        ==================================================
    */

    .error {
        display:
            block;

        height:
            auto;

        max-height:
            none;

        overflow:
            visible;

        text-align:
            center;

        margin:
            1.5em auto 0;

        color:
            #c55;
    }


    @media (
        max-width: 650px
    ) {
        .aiWriter {
            width:
                97%;

            padding:
                1.5em 1em;
        }


        h3 {
            font-size:
                1.6em;
        }


        .article {
            width:
                100%;

            padding:
                0;
        }


        .headline {
            font-size:
                1.3em;
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
