<script>
    import LinearProgress from '@smui/linear-progress';


    export let data;


    const impactInfo =
        data.impactInfo;


    const score =
        value => {

        const number =
            Number(
                value
            );


        if (
            !Number.isFinite(
                number
            )
        ) {
            return '0';
        }


        return Number.isInteger(
            number
        )
            ? String(
                number
            )
            : number.toFixed(
                2
            );
    };


    const gameLabel =
        game => {

        if (
            game.type ===
                'playoff'
        ) {
            return (
                `${game.year} ${game.playoffLabel || 'Playoff'}`
            );
        }


        return (
            `${game.year} Week ${game.week}`
        );
    };


    const matchupText =
        game => {

        return (
            `${game.winnerName} ${score(game.winnerScore)} – ` +
            `${game.loserName} ${score(game.loserScore)}`
        );
    };


    const impactScore =
        (
            game,
            negative = false
        ) => {

        const value =
            Number(
                game?.finalScore
            ) ||
            0;


        return negative
            ? `-${value}`
            : `${value}`;
    };


    const coreImpactScore =
        (
            game,
            negative = false
        ) => {

        const value =
            Number(
                game?.coreScore
            ) ||
            0;


        return negative
            ? `-${value}`
            : `${value}`;
    };


    const signedBonus =
        (
            value,
            negative = false
        ) => {

        const number =
            Number(
                value
            ) ||
            0;


        return negative
            ? `-${number}`
            : `+${number}`;
    };


    const hasBonus =
        game => {

        return (
            Number(
                game?.dramaBonus
            ) > 0 ||
            Number(
                game?.projectionBonus
            ) > 0
        );
    };
</script>


<style>
    #main {
        position: relative;
        z-index: 1;
        width: 96%;
        max-width: 1250px;
        margin: 0 auto 4em;
    }


    h1 {
        text-align: center;
        margin: 1.5em 0 0.35em;
        font-size: 2.3em;
    }


    .intro {
        width: 90%;
        max-width: 850px;
        margin: 0 auto 2.5em;
        text-align: center;
        line-height: 1.6;
        color: var(--g777);
    }


    .loading {
        display: block;
        width: 85%;
        max-width: 500px;
        margin: 80px auto;
    }


    .columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2em;
        align-items: start;
    }


    .column {
        min-width: 0;
    }


    .columnTitle {
        text-align: center;
        font-size: 1.7em;
        margin: 0 0 0.3em;
    }


    .columnDescription {
        text-align: center;
        color: var(--g777);
        font-size: 0.88em;
        margin: 0 auto 1.5em;
        max-width: 475px;
        min-height: 2.8em;
        line-height: 1.45;
    }


    .impactCard {
        position: relative;
        box-sizing: border-box;
        width: 100%;
        margin: 0 0 1em;
        padding: 1.15em 1.2em;
        border: 1px solid var(--aaa);
        border-radius: 14px;
        background: var(--rivalryBack);
    }


    .cardTop {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1em;
        margin-bottom: 0.55em;
    }


    .cardIdentity {
        min-width: 0;
    }


    .rank {
        display: inline-block;
        margin-right: 0.4em;
        font-size: 1.2em;
        font-weight: 800;
        line-height: 1;
    }


    .when {
        display: inline-block;
        font-size: 0.82em;
        color: var(--g777);
        font-weight: 600;
    }


    .impactScore {
        flex: 0 0 auto;
        min-width: 58px;
        text-align: center;
        border: 1px solid var(--aaa);
        border-radius: 9px;
        padding: 0.35em 0.45em;
        font-size: 0.72em;
        color: var(--g777);
        line-height: 1.15;
    }


    .impactScore strong {
        display: block;
        font-size: 1.7em;
        color: var(--text);
        line-height: 1.05;
    }


    .tag {
        display: block;
        width: fit-content;
        margin-top: 0.45em;
        margin-bottom: 0.45em;
        padding: 0.22em 0.55em;
        border: 1px solid var(--aaa);
        border-radius: 999px;
        font-size: 0.67em;
        font-weight: 700;
        letter-spacing: 0.035em;
    }


    .manager {
        font-size: 1.12em;
        font-weight: 650;
        margin-bottom: 0.3em;
    }


    .matchup {
        font-size: 0.9em;
        margin-bottom: 0.8em;
        line-height: 1.4;
    }


    .reasons {
        margin: 0.65em 0 0;
        padding-left: 1.15em;
        font-size: 0.86em;
        line-height: 1.5;
        color: var(--g777);
    }


    .reasons li {
        margin-bottom: 0.27em;
    }


    .bonuses {
        margin-top: 0.75em;
        padding-top: 0.6em;
        border-top: 1px solid var(--aaa);
        font-size: 0.75em;
        color: var(--g777);
        line-height: 1.55;
    }


    .projectionInfo {
        margin-top: 0.35em;
        font-style: italic;
    }


    .noGames {
        padding: 2em;
        text-align: center;
        color: var(--g777);
        font-style: italic;
    }


    .method {
        width: 90%;
        max-width: 850px;
        margin: 2.5em auto 0;
        padding: 1.25em 1.5em;
        box-sizing: border-box;
        border: 1px solid var(--aaa);
        border-radius: 14px;
        font-size: 0.82em;
        line-height: 1.55;
        color: var(--g777);
    }


    .method strong {
        color: var(--text);
    }


    @media (
        max-width: 850px
    ) {
        .columns {
            grid-template-columns: 1fr;
        }


        .columnDescription {
            min-height: 0;
        }
    }


    @media (
        max-width: 500px
    ) {
        #main {
            width: 97%;
        }


        h1 {
            font-size: 1.9em;
        }


        .impactCard {
            padding: 1em;
        }


        .cardTop {
            gap: 0.5em;
        }


        .impactScore {
            min-width: 52px;
        }
    }
</style>


<div id="main">

    <h1>
        Historically Impactful Games
    </h1>


    <div class="intro">
        The 50 strongest positive and negative turning points
        in league history, ranked by Impact score. Impact measures
        short-term change, long-term program trajectory, streaks,
        and postseason significance. Close finishes and genuine
        projection upsets can provide small bonuses after a game
        has already demonstrated historical impact.
    </div>


    {#await impactInfo}

        <div class="loading">

            <p>
                Analyzing league history...
            </p>

            <LinearProgress
                indeterminate
            />

        </div>


    {:then impact}

        <div class="columns">


            <!-- =========================================
                 POSITIVE
                 ========================================= -->

            <section class="column">

                <h2 class="columnTitle">
                    Positive Impact
                </h2>


                <div class="columnDescription">
                    Wins followed by the strongest measurable improvement
                    in a manager's results.
                </div>


                {#each impact.positive as game, index}

                    <article class="impactCard">

                        <div class="cardTop">

                            <div class="cardIdentity">

                                <div>

                                    <span class="rank">
                                        #{index + 1}
                                    </span>

                                    <span class="when">
                                        {gameLabel(game)}
                                    </span>

                                </div>


                                <div class="tag">
                                    {game.label}
                                </div>

                            </div>


                            <div class="impactScore">

                                IMPACT

                                <strong>
                                    {impactScore(game)}
                                </strong>

                            </div>

                        </div>


                        <div class="manager">
                            Impact on {game.managerName}
                        </div>


                        <div class="matchup">
                            {matchupText(game)}
                        </div>


                        <ul class="reasons">

                            {#each game.reasons as reason}

                                <li>
                                    {reason}
                                </li>

                            {/each}

                        </ul>


                        {#if hasBonus(game)}

                            <div class="bonuses">

                                Core Impact:
                                {coreImpactScore(game)}


                                {#if game.dramaBonus > 0}

                                    · Close-game bonus:
                                    {signedBonus(
                                        game.dramaBonus
                                    )}

                                {/if}


                                {#if game.projectionBonus > 0}

                                    · Upset bonus:
                                    {signedBonus(
                                        game.projectionBonus
                                    )}


                                    <div class="projectionInfo">

                                        Projected:
                                        {game.winnerName}
                                        {score(game.winnerProjection)}
                                        –
                                        {game.loserName}
                                        {score(game.loserProjection)}

                                    </div>

                                {/if}

                            </div>

                        {/if}

                    </article>


                {:else}

                    <div class="noGames">
                        No games currently clear the positive-impact threshold.
                    </div>

                {/each}

            </section>


            <!-- =========================================
                 NEGATIVE
                 ========================================= -->

            <section class="column">

                <h2 class="columnTitle">
                    Negative Impact
                </h2>


                <div class="columnDescription">
                    Losses followed by the strongest measurable decline
                    in a manager's results.
                </div>


                {#each impact.negative as game, index}

                    <article class="impactCard">

                        <div class="cardTop">

                            <div class="cardIdentity">

                                <div>

                                    <span class="rank">
                                        #{index + 1}
                                    </span>

                                    <span class="when">
                                        {gameLabel(game)}
                                    </span>

                                </div>


                                <div class="tag">
                                    {game.label}
                                </div>

                            </div>


                            <div class="impactScore">

                                IMPACT

                                <strong>
                                    {impactScore(
                                        game,
                                        true
                                    )}
                                </strong>

                            </div>

                        </div>


                        <div class="manager">
                            Impact on {game.managerName}
                        </div>


                        <div class="matchup">
                            {matchupText(game)}
                        </div>


                        <ul class="reasons">

                            {#each game.reasons as reason}

                                <li>
                                    {reason}
                                </li>

                            {/each}

                        </ul>


                        {#if hasBonus(game)}

                            <div class="bonuses">

                                Core Impact:
                                {coreImpactScore(
                                    game,
                                    true
                                )}


                                {#if game.dramaBonus > 0}

                                    · Close-game bonus:
                                    {signedBonus(
                                        game.dramaBonus,
                                        true
                                    )}

                                {/if}


                                {#if game.projectionBonus > 0}

                                    · Upset bonus:
                                    {signedBonus(
                                        game.projectionBonus,
                                        true
                                    )}


                                    <div class="projectionInfo">

                                        Projected:
                                        {game.loserName}
                                        {score(game.loserProjection)}
                                        –
                                        {game.winnerName}
                                        {score(game.winnerProjection)}

                                    </div>

                                {/if}

                            </div>

                        {/if}

                    </article>


                {:else}

                    <div class="noGames">
                        No games currently clear the negative-impact threshold.
                    </div>

                {/each}

            </section>

        </div>


        <div class="method">

            <strong>
                How Impact works:
            </strong>

            Core Impact measures whether a game sits at a meaningful
            change in a manager's trajectory. The largest component
            compares the manager's results across the two seasons
            preceding the game's season with the following three
            seasons, while shorter five-game and ten-game windows,
            same-season movement, meaningful streaks, and
            championship-bracket games provide additional context.
            Once a game already clears the historical-impact threshold,
            a close finish can add up to eight points. When historical
            Sleeper projections are available, a projected underdog
            winning can add up to four more points. Projection
            differences under five points are treated as toss-ups.
            Negative Impact scores use minus signs to represent a
            downward change in trajectory.

        </div>


    {:catch error}

        <p>
            Something went wrong:
            {error.message}
        </p>

    {/await}

</div>
