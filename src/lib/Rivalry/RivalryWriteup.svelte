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
        COMPACT LEDGER ENTRY
        ==================================================

        The full fact engine has a lot of useful internal
        bookkeeping.

        Groq does not need all of it.

        It DOES need:
          - exact date
          - exact winner
          - exact score
          - exact series state before
          - exact series state after

        This is enough to discuss historical evolution
        without ever doing arithmetic.
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
                meetingNumber:
                    entry.meetingNumber,

                label:
                    entry.label,

                type:
                    entry.type,

                winner:
                    entry.winner,

                tie:
                    entry.tie,

                score:
                    entry.score,

                margin:
                    entry.margin,

                seriesBefore:
                    entry.seriesBefore,

                seriesAfter:
                    entry.seriesAfter
            })
        );
    };


    /*
        ==================================================
        COMPACT STREAK
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

            firstWinInStreak:
                streak.firstWinInStreak,

            mostRecentWinInStreak:
                streak.mostRecentWinInStreak,

            recordImmediatelyBeforeStreak:
                streak.recordImmediatelyBeforeStreakText,

            currentRecord:
                streak.currentRecordText,

            verifiedEffect:
                streak.verifiedEffect
        };
    };


    /*
        ==================================================
        COMPACT LONGEST STREAK
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
                streak.end,

            firstGame:
                streak.firstGame ||
                null,

            lastGame:
                streak.lastGame ||
                null
        };
    };


    /*
        ==================================================
        RECENT WINDOW
        ==================================================

        We only need the verified record plus the exact
        meetings for the shorter windows.

        The last-10 raw list is redundant with the main
        chronological ledger, so it is omitted.
    */

    const compactRecentWindow =
        (
            window,
            includeGames = false
        ) => {

        if (!window) {
            return null;
        }


        const result = {
            actualGames:
                window.actualGames,

            record:
                window.recordText
        };


        if (
            includeGames &&
            Array.isArray(
                window.meetings
            )
        ) {
            result.meetings =
                window.meetings;
        }


        return result;
    };


    /*
        ==================================================
        SEASON HISTORY
        ==================================================

        The full structure repeats every game's details.

        Those exact games already live in the ledger, so
        here Groq only needs the season summary.
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
        BUILD WRITER DOSSIER
        ==================================================

        This is the important change.

        buildRivalryFactSheet() can remain enormous and rich.

        But we transmit ONE non-redundant representation
        of the useful facts to Groq.
    */

    const buildWriterDossier =
        factSheet => {

        const managerOne =
            factSheet
                ?.managers
                ?.managerOne;

        const managerTwo =
            factSheet
                ?.managers
                ?.managerTwo;


        return {
            /*
                ==========================================
                BASIC IDENTITY
                ==========================================
            */

            managers:
                factSheet.managers,


            /*
                ==========================================
                CURRENT SERIES
                ==========================================
            */

            meetingCounts:
                factSheet.meetingCounts,

            currentRecords:
                factSheet.currentRecords,

            firstAndMostRecent:
                factSheet.firstAndMostRecent,


            /*
                ==========================================
                STREAKS
                ==========================================
            */

            streaks: {
                regularSeason: {
                    current:
                        compactCurrentStreak(
                            factSheet
                                ?.streaks
                                ?.regularSeason
                                ?.current
                        ),

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
                    }
                },


                playoffs: {
                    current:
                        compactCurrentStreak(
                            factSheet
                                ?.streaks
                                ?.playoffs
                                ?.current
                        ),

                    longest: {
                        [managerOne]:
                            compactLongest(
                                factSheet
                                    ?.streaks
                                    ?.playoffs
                                    ?.longestByManager
                                    ?.[managerOne]
                            ),

                        [managerTwo]:
                            compactLongest(
                                factSheet
                                    ?.streaks
                                    ?.playoffs
                                    ?.longestByManager
                                    ?.[managerTwo]
                            )
                    }
                }
            },


            /*
                ==========================================
                RECENT HISTORY
                ==========================================
            */

            recentRegularSeason: {
                last3:
                    compactRecentWindow(
                        factSheet
                            ?.recentRegularSeason
                            ?.last3,
                        true
                    ),

                last5:
                    compactRecentWindow(
                        factSheet
                            ?.recentRegularSeason
                            ?.last5,
                        true
                    ),

                last10:
                    compactRecentWindow(
                        factSheet
                            ?.recentRegularSeason
                            ?.last10,
                        false
                    )
            },


            /*
                ==========================================
                SCORING
                ==========================================
            */

            scoring:
                factSheet.scoring,


            /*
                ==========================================
                SEASON-BY-SEASON SUMMARY
                ==========================================
            */

            seasonBySeason: {
                regularSeason:
                    compactSeasons(
                        factSheet
                            ?.seasonBySeason
                            ?.regularSeason
                    ),

                playoffs:
                    compactSeasons(
                        factSheet
                            ?.seasonBySeason
                            ?.playoffs
                    )
            },


            /*
                ==========================================
                SERIES LEAD CHANGES
                ==========================================
            */

            seriesLeadHistory:
                factSheet.seriesLeadHistory,


            /*
                ==========================================
                EXACT HISTORICAL LEDGER

                ONE regular-season copy.
                ONE playoff copy.

                No combined duplicate.
                ==========================================
            */

            chronology: {
                explanation:
                    (
                        'These are chronological MEETINGS. ' +
                        'Adjacent entries are not necessarily adjacent NFL weeks. ' +
                        'seriesBefore and seriesAfter are authoritative.'
                    ),

                regularSeason:
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


            /*
                ==========================================
                TRADES
                ==========================================
            */

            trades:
                factSheet.trades,


            /*
                ==========================================
                CAREER CONTEXT
                ==========================================
            */

            overallCareerContext:
                factSheet.overallCareerContext
        };
    };


    /*
        ==================================================
        PAYLOAD
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


        /*
            Build the COMPLETE historical analysis first.
        */
        const fullFactSheet =
            buildRivalryFactSheet({
                rivalry,

                managerOneName,

                managerTwoName,

                tradeHistory,

                playerOneRecords,

                playerTwoRecords
            });


        /*
            Then distill it for the writer.
        */
        const writerDossier =
            buildWriterDossier(
                fullFactSheet
            );


        return {
            managerOne:
                managerOneName,

            managerTwo:
                managerTwoName,

            factSheet:
                writerDossier
        };
    };


    /*
        ==================================================
        READ ERROR RESPONSE
        ==================================================

        If Vercel/Groq ever returns HTML/plain text instead
        of JSON, do not hide the HTTP status anymore.
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
            const suppliedError =
                result?.error;


            if (suppliedError) {
                throw new Error(
                    `${response.status}: ${suppliedError}`
                );
            }


            const shortText =
                text
                    ?.trim()
                    ?.slice(
                        0,
                        300
                    );


            throw new Error(
                shortText
                    ? (
                        `${response.status}: ${shortText}`
                    )
                    : (
                        `HTTP ${response.status}`
                    )
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


        /*
            Preserve the existing article while generating
            Another Take.

            Clear it only when we are automatically loading
            a newly selected rivalry.
        */
        if (automatic) {
            article =
                null;

            model =
                '';

            writer =
                '';
        }


        try {
            const payload =
                buildPayload();


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
                                payload
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
        height: auto;
        max-height: none;
        overflow: visible;
        margin: 0 auto 1.5em;
        text-align: center;
        color: #888;
        font-size: 0.9em;
    }


    .writing {
        width: 85%;
        max-width: 550px;
        height: auto;
        margin: 2em auto;
        text-align: center;
        color: #888;
        font-style: italic;
    }


    .article {
        display: block;
        width: 100%;
        max-width: 800px;
        min-height: 0;
        height: auto;
        max-height: none;
        overflow: visible;
        box-sizing: border-box;
        margin: 2em auto 0;
        padding: 0 0.25em;
        line-height: 1.7;
        white-space: normal;
    }


    .headline {
        display: block;
        width: 100%;
        height: auto;
        max-height: none;
        overflow: visible;
        box-sizing: border-box;
        font-size: 1.5em;
        font-weight: 650;
        line-height: 1.3;
        margin: 0 0 1.3em;
        text-align: center;
        white-space: normal;
        overflow-wrap: anywhere;
    }


    .paragraph {
        display: block;
        width: 100%;
        min-height: 0;
        height: auto;
        max-height: none;
        overflow: visible;
        box-sizing: border-box;
        margin: 0 0 1.25em;
        white-space: normal;
        overflow-wrap: break-word;
    }


    .paragraph:last-child {
        margin-bottom: 0;
    }


    .byline {
        display: block;
        height: auto;
        max-height: none;
        overflow: visible;
        margin-top: 1.75em;
        text-align: center;
        font-size: 0.75em;
        color: #999;
    }


    .buttonHolder {
        display: block;
        height: auto;
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
        display: block;
        height: auto;
        max-height: none;
        overflow: visible;
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


        .article {
            width: 100%;
            padding: 0;
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
