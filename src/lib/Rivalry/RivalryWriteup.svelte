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


        const factSheet =
            buildRivalryFactSheet({
                rivalry,

                managerOneName,

                managerTwoName,

                tradeHistory,

                playerOneRecords,

                playerTwoRecords
            });


        /*
            The fact sheet is now the authoritative source.

            We intentionally do NOT send a second competing
            representation of the same wins/losses/streaks.
            That reduces opportunities for the writer to mix
            different meanings together.
        */

        return {
            managerOne:
                managerOneName,

            managerTwo:
                managerTwoName,

            factSheet
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


        generating =
            true;

        error =
            '';


        /*
            Initial automatic generation clears the prior
            article because the selected rivalry changed.

            "Another Take" leaves the old article visible
            until the new one is ready.
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

        Include point totals as well as game counts.

        That way a newly completed game can trigger a fresh
        article even if Sleeper had already created the matchup
        shell beforehand.
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
