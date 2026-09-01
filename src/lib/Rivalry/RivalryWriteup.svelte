<script>
    import {
        buildRivalryFactSheet
    } from '$lib/utils/helperFunctions/rivalryFactSheet';


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
        RIVALRY IDENTITY FOR WRITER
        ==================================================

        The ranking/classification engine can know much
        more than the writer needs to say.

        Important editorial rule:

        NORMAL and MODERATE are useful internally, but
        they are NOT interesting talking points.

        The writer should never produce things like:

        "middle of the frequency spectrum"

        simply because a matchup is ordinary.
    */

    const compactLeagueContext =
        context => {

        if (!context) {
            return null;
        }


        const result = {};


        /*
            Only noteworthy size classifications deserve
            to become writer material.
        */

        if (
            context.sizeTier ===
                'BIG'
        ) {
            result.importance =
                'BIG';

            result.importanceDescription =
                context.sizeDescription;
        }
        else if (
            context.sizeTier ===
                'SMALL'
        ) {
            result.importance =
                'SMALL';

            result.importanceDescription =
                context.sizeDescription;
        }
        else if (
            context.sizeTier ===
                'NEW'
        ) {
            result.importance =
                'NEW';

            result.importanceDescription =
                context.sizeDescription;
        }


        /*
            Likewise, MODERATE frequency is not a story.

            Extremely frequent, frequent, and infrequent
            can actually characterize the rivalry.
        */

        if (
            context.frequencyClass ===
                'EXTREMELY_FREQUENT' ||
            context.frequencyClass ===
                'FREQUENT' ||
            context.frequencyClass ===
                'INFREQUENT'
        ) {
            result.familiarity =
                context.frequencyClass;

            result.familiarityDescription =
                context.frequencyDescription;
        }


        /*
            Cadence is useful because it prevents the
            writer from inventing annual regularity.

            We preserve it even when ordinary.
        */

        if (
            context.cadenceClass
        ) {
            result.cadence =
                context.cadenceClass;

            result.cadenceDescription =
                context.cadenceDescription;
        }


        if (
            context.managerOneRelationship
        ) {
            result.managerOneRelationship =
                context.managerOneRelationship;
        }


        if (
            context.managerTwoRelationship
        ) {
            result.managerTwoRelationship =
                context.managerTwoRelationship;
        }


        return (
            Object.keys(
                result
            ).length
                ? result
                : null
        );
    };


    /*
        ==================================================
        LEDGER
        ==================================================
    */

    const compactLedger =
        ledger => {

        if (
            !Array.isArray(
                ledger
            )
        ) {
            return [];
        }


        return ledger.map(
            entry => ({
                n:
                    entry.meetingNumber,

                when:
                    entry.label,

                winner:
                    entry.winner,

                tie:
                    entry.tie,

                score:
                    entry.score,

                margin:
                    entry.margin,

                before:
                    entry.seriesBefore,

                after:
                    entry.seriesAfter
            })
        );
    };


    /*
        ==================================================
        CURRENT STREAK
        ==================================================
    */

    const compactCurrentStreak =
        streak => {

        if (!streak) {
            return null;
        }


        if (
            streak.type ===
                'tie'
        ) {
            return {
                type:
                    'tie',

                statement:
                    streak.statement ||
                    null
            };
        }


        return {
            manager:
                streak.manager,

            length:
                streak.length,

            began:
                streak.began,

            mostRecent:
                streak.mostRecent,

            recordBefore:
                streak
                    .recordImmediatelyBeforeStreakText,

            currentRecord:
                streak
                    .currentRecordText,

            effect:
                streak
                    .verifiedEffect
        };
    };


    /*
        ==================================================
        LONGEST STREAK
        ==================================================
    */

    const compactLongest =
        streak => {

        if (!streak) {
            return null;
        }


        return {
            manager:
                streak.manager,

            length:
                streak.length,

            start:
                streak.start,

            end:
                streak.end
        };
    };


    /*
        ==================================================
        EXTREME GAME
        ==================================================
    */

    const compactExtreme =
        game => {

        if (!game) {
            return null;
        }


        return {
            when:
                game.label,

            winner:
                game.winner,

            score:
                game.score,

            margin:
                game.margin,

            total:
                game.combinedScore
        };
    };


    /*
        ==================================================
        INDIVIDUAL SCORING
        ==================================================
    */

    const compactIndividual =
        stats => {

        if (!stats) {
            return null;
        }


        return {
            average:
                stats.averageScore,

            high:
                stats.highestScore,

            low:
                stats.lowestScore,

            atLeast150:
                stats.gamesAtOrAbove150,

            atLeast175:
                stats.gamesAtOrAbove175,

            atLeast200:
                stats.gamesAtOrAbove200,

            below100:
                stats.gamesBelow100
        };
    };


    /*
        ==================================================
        SCORING
        ==================================================
    */

    const compactScoring = (
        factSheet,
        managerOne,
        managerTwo
    ) => {
        const regular =
            factSheet
                ?.scoring
                ?.regularSeason;


        const playoffs =
            factSheet
                ?.scoring
                ?.playoffs;


        return {
            regularSeason: {
                [managerOne]:
                    compactIndividual(
                        regular
                            ?.[managerOne]
                    ),

                [managerTwo]:
                    compactIndividual(
                        regular
                            ?.[managerTwo]
                    ),

                averageMargin:
                    regular
                        ?.averageMargin,

                medianMargin:
                    regular
                        ?.medianMargin,

                closest:
                    compactExtreme(
                        regular
                            ?.extremes
                            ?.closest
                    ),

                biggestBlowout:
                    compactExtreme(
                        regular
                            ?.extremes
                            ?.biggestBlowout
                    ),

                highestCombined:
                    compactExtreme(
                        regular
                            ?.extremes
                            ?.highestCombinedScore
                    ),

                lowestCombined:
                    compactExtreme(
                        regular
                            ?.extremes
                            ?.lowestCombinedScore
                    )
            },


            playoffs:
                factSheet
                    ?.meetingCounts
                    ?.playoffs
                    ? {
                        [managerOne]:
                            compactIndividual(
                                playoffs
                                    ?.[managerOne]
                            ),

                        [managerTwo]:
                            compactIndividual(
                                playoffs
                                    ?.[managerTwo]
                            ),

                        closest:
                            compactExtreme(
                                playoffs
                                    ?.extremes
                                    ?.closest
                            ),

                        biggestBlowout:
                            compactExtreme(
                                playoffs
                                    ?.extremes
                                    ?.biggestBlowout
                            )
                    }
                    : null
        };
    };


    /*
        ==================================================
        SEASON SUMMARIES
        ==================================================
    */

    const compactSeasons =
        seasons => {

        if (
            !Array.isArray(
                seasons
            )
        ) {
            return [];
        }


        return seasons.map(
            season => ({
                year:
                    season.year,

                meetings:
                    season.meetings,

                record:
                    season.recordText,

                result:
                    season.result
            })
        );
    };


    /*
        ==================================================
        LEAD CHANGES
        ==================================================
    */

    const compactLeadChanges =
        changes => {

        if (
            !Array.isArray(
                changes
            )
        ) {
            return [];
        }


        return changes.map(
            item => ({
                when:
                    item.afterMeeting,

                leader:
                    item.leader,

                record:
                    item.record
            })
        );
    };


    /*
        ==================================================
        CAREER
        ==================================================
    */

    const compactCareer =
        career => {

        if (!career) {
            return null;
        }


        return {
            games:
                career.games,

            wins:
                career.wins,

            losses:
                career.losses,

            ties:
                career.ties,

            winPct:
                career.winPercentage,

            pointsPerGame:
                career
                    .fantasyPointsPerGame
        };
    };


    /*
        ==================================================
        RECENT HISTORY WITH REDUNDANCY PRUNING
        ==================================================

        A current four-game winning streak already proves
        that manager won the last three.

        Giving the writer both facts encourages it to say
        both facts.

        So narrower windows wholly contained by the
        current streak are removed before generation.
    */

    const buildRecentContext =
        factSheet => {

        const currentStreak =
            factSheet
                ?.streaks
                ?.regularSeason
                ?.current;


        const streakLength =
            (
                currentStreak &&
                currentStreak.type !==
                    'tie'
            )
                ? (
                    Number(
                        currentStreak.length
                    ) ||
                    0
                )
                : 0;


        const recent =
            {};


        if (
            streakLength < 3
        ) {
            recent.last3 =
                factSheet
                    ?.recentRegularSeason
                    ?.last3
                    ?.recordText ||
                null;
        }


        if (
            streakLength < 5
        ) {
            recent.last5 =
                factSheet
                    ?.recentRegularSeason
                    ?.last5
                    ?.recordText ||
                null;
        }


        if (
            streakLength < 10
        ) {
            recent.last10 =
                factSheet
                    ?.recentRegularSeason
                    ?.last10
                    ?.recordText ||
                null;
        }


        /*
            Remove nulls so they cost no tokens and cannot
            distract the writer.
        */

        for (
            const key
            of Object.keys(
                recent
            )
        ) {
            if (!recent[key]) {
                delete recent[key];
            }
        }


        return (
            Object.keys(
                recent
            ).length
                ? recent
                : null
        );
    };


    /*
        ==================================================
        WRITER DOSSIER
        ==================================================
    */

    const buildWriterDossier = (
        factSheet,
        leagueContext
    ) => {
        const managerOne =
            factSheet
                ?.managers
                ?.managerOne;


        const managerTwo =
            factSheet
                ?.managers
                ?.managerTwo;


        const currentStreak =
            compactCurrentStreak(
                factSheet
                    ?.streaks
                    ?.regularSeason
                    ?.current
            );


        return {
            rivalryIdentity:
                compactLeagueContext(
                    leagueContext
                ),


            meetings:
                factSheet
                    ?.meetingCounts,


            records: {
                regular:
                    factSheet
                        ?.currentRecords
                        ?.regularSeason
                        ?.statement,

                playoffs:
                    factSheet
                        ?.currentRecords
                        ?.playoffs
                        ?.statement,

                combined:
                    factSheet
                        ?.currentRecords
                        ?.combined
                        ?.statement
            },


            firstAndLatest:
                factSheet
                    ?.firstAndMostRecent,


            streaks: {
                current:
                    currentStreak,

                longest: {
                    [managerOne]:
                        compactLongest(
                            factSheet
                                ?.streaks
                                ?.regularSeason
                                ?.longestByManager
                                ?.[managerOne]
                        ),

                    [managerTwo]:
                        compactLongest(
                            factSheet
                                ?.streaks
                                ?.regularSeason
                                ?.longestByManager
                                ?.[managerTwo]
                        )
                },

                playoffCurrent:
                    compactCurrentStreak(
                        factSheet
                            ?.streaks
                            ?.playoffs
                            ?.current
                    )
            },


            /*
                Narrower recent windows may be omitted
                automatically when the current streak
                already contains them.
            */

            recent:
                buildRecentContext(
                    factSheet
                ),


            scoring:
                compactScoring(
                    factSheet,
                    managerOne,
                    managerTwo
                ),


            seasons:
                compactSeasons(
                    factSheet
                        ?.seasonBySeason
                        ?.regularSeason
                ),


            leadChanges:
                compactLeadChanges(
                    factSheet
                        ?.seriesLeadHistory
                        ?.regularSeason
                ),


            maximumSeriesLead:
                factSheet
                    ?.seriesLeadHistory
                    ?.maximumRegularSeasonLead,


            chronology: {
                regular:
                    compactLedger(
                        factSheet
                            ?.chronology
                            ?.regularSeasonLedger
                    ),

                playoffs:
                    compactLedger(
                        factSheet
                            ?.chronology
                            ?.playoffLedger
                    )
            },


            trades:
                factSheet
                    ?.trades,


            career: {
                [managerOne]:
                    compactCareer(
                        factSheet
                            ?.overallCareerContext
                            ?.[managerOne]
                    ),

                [managerTwo]:
                    compactCareer(
                        factSheet
                            ?.overallCareerContext
                            ?.[managerTwo]
                    )
            }
        };
    };


    /*
        ==================================================
        BUILD REQUEST
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


        const fullFactSheet =
            buildRivalryFactSheet({
                rivalry,

                managerOneName,

                managerTwoName,

                tradeHistory,

                playerOneRecords,

                playerTwoRecords
            });


        return {
            managerOne:
                managerOneName,

            managerTwo:
                managerTwoName,

            factSheet:
                buildWriterDossier(
                    fullFactSheet,
                    rivalry
                        ?.leagueContext
                )
        };
    };


    /*
        ==================================================
        RESPONSE
        ==================================================
    */

    const readResponse =
        async response => {

        const text =
            await response.text();


        let result =
            null;


        try {
            result =
                JSON.parse(
                    text
                );
        }
        catch {
            result =
                null;
        }


        if (!response.ok) {
            if (
                result?.error
            ) {
                throw new Error(
                    `${response.status}: ${result.error}`
                );
            }


            throw new Error(
                text
                    ?.trim()
                    ?.slice(
                        0,
                        300
                    ) ||
                `HTTP ${response.status}`
            );
        }


        if (!result) {
            throw new Error(
                'The writer returned an unreadable response.'
            );
        }


        return result;
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


        generating =
            true;

        error =
            '';


        if (automatic) {
            article =
                null;

            model =
                '';

            writer =
                '';
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
                await readResponse(
                    response
                );


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
        AUTOMATIC GENERATION KEY
        ==================================================
    */

    $: regularPointsOne =
        rivalry
            ?.regularSeason
            ?.points
            ?.one ||
        0;


    $: regularPointsTwo =
        rivalry
            ?.regularSeason
            ?.points
            ?.two ||
        0;


    $: playoffPointsOne =
        rivalry
            ?.playoffs
            ?.points
            ?.one ||
        0;


    $: playoffPointsTwo =
        rivalry
            ?.playoffs
            ?.points
            ?.two ||
        0;


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
                `${rivalry?.playoffs?.matchups?.length || 0}|` +
                `${regularPointsOne}|` +
                `${regularPointsTwo}|` +
                `${playoffPointsOne}|` +
                `${playoffPointsTwo}`
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
    .aiWriter {
        display: block;
        width: 97%;
        max-width: 1000px;
        min-height: 0;
        height: auto;
        max-height: none;
        overflow: visible;
        box-sizing: border-box;
        margin: 2em auto;
        padding: 2em;
        border-radius: 20px;
        border: 1px solid var(--aaa);
        background-color: var(--rivalryBack);
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

    .writing {
        width: 85%;
        max-width: 550px;
        margin: 2em auto;
        text-align: center;
        color: #888;
        font-style: italic;
    }

    .article {
        width: 100%;
        max-width: 800px;
        margin: 2em auto 0;
        line-height: 1.7;
    }

    .headline {
        font-size: 1.5em;
        font-weight: 650;
        line-height: 1.3;
        margin: 0 0 1.3em;
        text-align: center;
        overflow-wrap: anywhere;
    }

    .paragraph {
        margin: 0 0 1.25em;
        overflow-wrap: break-word;
    }

    .paragraph:last-child {
        margin-bottom: 0;
    }

    .byline {
        margin-top: 1.75em;
        text-align: center;
        font-size: 0.75em;
        color: #999;
    }

    .buttonHolder {
        margin-top: 1.75em;
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

    .error {
        text-align: center;
        margin: 1.5em auto 0;
        color: #c55;
    }

    @media (
        max-width: 650px
    ) {
        .aiWriter {
            width: 97%;
            padding: 1.5em 1em;
        }

        h3 {
            font-size: 1.6em;
        }

        .headline {
            font-size: 1.3em;
        }
    }
</style>


<div class="aiWriter">

    <h3>
        AI Rivalry Column
    </h3>


    <div class="intro">
        The league history supplies the facts.
        A rotating AI columnist supplies the take.
    </div>


    {#if generating && !article}

        <div class="writing">
            Researching the rivalry and writing the column...
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
