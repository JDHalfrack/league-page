<script>
    export let data;


    let showOnlyEligible =
        true;


    let expandedTradeID =
        null;


    $:
        diagnostics =
            data
                ?.diagnostics ||
            {};


    $:
        players =
            data
                ?.playersData
                ?.players ||
            {};


    $:
        trades =
            showOnlyEligible
                ? (
                    diagnostics
                        ?.eligibleTrades ||
                    []
                )
                : (
                    diagnostics
                        ?.trades ||
                    []
                );


    const playerName =
        playerID => {

            const player =
                players[
                    playerID
                ];


            if (!player) {
                return (
                    `Player ${playerID}`
                );
            }


            const name =
                [
                    player.fn,
                    player.ln
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        ' '
                    );


            return (
                name ||
                `Player ${playerID}`
            );
        };


    const pickLabel =
        pick => {

            const base =
                (
                    `${pick.season} ` +
                    `Round ${pick.round} ` +
                    `(original roster ${pick.originalRosterID})`
                );


            if (
                pick
                    ?.resolved
                    ?.selectedPlayerID
            ) {
                return (
                    `${base} → ` +
                    `${playerName(
                        pick
                            .resolved
                            .selectedPlayerID
                    )}`
                );
            }


            return base;
        };


    const formatDate =
        value => {

            if (!value) {
                return '';
            }


            return new Intl
                .DateTimeFormat(
                    'en-US',
                    {
                        year:
                            'numeric',

                        month:
                            'short',

                        day:
                            'numeric'
                    }
                )
                .format(
                    new Date(
                        value
                    )
                );
        };


    const toggleTrade =
        tradeID => {

            expandedTradeID =
                expandedTradeID ===
                    tradeID
                    ? null
                    : tradeID;
        };
</script>


<svelte:head>
    <title>
        Historical Trade Analyzer Diagnostic
    </title>
</svelte:head>


<div class="page">
    <section class="intro">
        <div class="eyebrow">
            Historical Trade Analyzer
        </div>

        <h1>
            Phase 1: Source Data Diagnostic
        </h1>

        <p>
            This page does not grade trades yet.
            It verifies the historical Sleeper data,
            resolves traded draft picks into the players
            eventually selected, and shows the raw assets
            on each side of every historical trade.
        </p>
    </section>


    <section class="summaryGrid">
        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.seasons ?? 0}
            </span>

            <span class="summaryLabel">
                Seasons
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.trades ?? 0}
            </span>

            <span class="summaryLabel">
                Trades Found
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.eligibleTrades ?? 0}
            </span>

            <span class="summaryLabel">
                2+ Years Old
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.resolvedDraftPicks ?? 0}
            </span>

            <span class="summaryLabel">
                Draft Picks Resolved
            </span>
        </div>
    </section>


    <section class="panel">
        <div class="panelHeader">
            <div>
                <h2>
                    Historical Data Validation
                </h2>

                <p>
                    Each season is sampled directly from its
                    archived Sleeper league.
                </p>
            </div>
        </div>


        <div class="validationTableWrap">
            <table class="validationTable">
                <thead>
                    <tr>
                        <th>
                            Season
                        </th>

                        <th>
                            Trades
                        </th>

                        <th>
                            Drops
                        </th>

                        <th>
                            Pick Moves
                        </th>

                        <th>
                            Drafts
                        </th>

                        <th>
                            Players
                        </th>

                        <th>
                            Starters
                        </th>

                        <th>
                            players_points
                        </th>

                        <th>
                            starters_points
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {#each diagnostics?.validations || [] as validation}
                        <tr>
                            <td>
                                {validation.year}
                            </td>

                            <td>
                                {validation.trades}
                            </td>

                            <td>
                                {validation.officialDrops}
                            </td>

                            <td>
                                {validation.draftPickMoves}
                            </td>

                            <td>
                                {validation.completedDrafts}
                            </td>

                            <td>
                                <span
                                    class:yes={validation.matchup.hasPlayers}
                                    class:no={!validation.matchup.hasPlayers}
                                >
                                    {validation.matchup.hasPlayers
                                        ? 'YES'
                                        : 'NO'}
                                </span>
                            </td>

                            <td>
                                <span
                                    class:yes={validation.matchup.hasStarters}
                                    class:no={!validation.matchup.hasStarters}
                                >
                                    {validation.matchup.hasStarters
                                        ? 'YES'
                                        : 'NO'}
                                </span>
                            </td>

                            <td>
                                <span
                                    class:yes={validation.matchup.hasPlayersPoints}
                                    class:no={!validation.matchup.hasPlayersPoints}
                                >
                                    {validation.matchup.hasPlayersPoints
                                        ? `YES (${validation.matchup.playersPointsType})`
                                        : 'NO'}
                                </span>
                            </td>

                            <td>
                                <span
                                    class:yes={validation.matchup.hasStartersPoints}
                                    class:no={!validation.matchup.hasStartersPoints}
                                >
                                    {validation.matchup.hasStartersPoints
                                        ? `YES (${validation.matchup.startersPointsType})`
                                        : 'NO'}
                                </span>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </section>


    <section class="panel">
        <div class="panelHeader tradeHeader">
            <div>
                <h2>
                    Raw Trade Ledger
                </h2>

                <p>
                    Expand a trade to inspect what every
                    participant sent and received.
                </p>
            </div>

            <label class="filter">
                <input
                    type="checkbox"
                    bind:checked={showOnlyEligible}
                />

                Only show trades at least two years old
            </label>
        </div>


        {#if !trades.length}
            <div class="empty">
                No trades matched this filter.
            </div>
        {:else}
            <div class="tradeList">
                {#each trades as trade, index}
                    <article class="tradeCard">
                        <button
                            class="tradeTitle"
                            type="button"
                            on:click={() => toggleTrade(trade.id)}
                        >
                            <div>
                                <span class="tradeNumber">
                                    Trade {index + 1}
                                </span>

                                <strong>
                                    {formatDate(trade.date)}
                                </strong>

                                <span class="tradeMeta">
                                    {trade.season}
                                    ·
                                    Sleeper round {trade.sourceRound}
                                    ·
                                    {trade.ageYears} years old
                                </span>
                            </div>

                            <span class:eligible={trade.eligible}
                                  class:notEligible={!trade.eligible}>
                                {trade.eligible
                                    ? 'ELIGIBLE'
                                    : 'TOO RECENT'}
                            </span>
                        </button>


                        {#if expandedTradeID === trade.id}
                            <div class="participantGrid">
                                {#each trade.participants as participant}
                                    <section class="participant">
                                        <h3>
                                            {participant.team.name}
                                        </h3>

                                        <div class="assetColumns">
                                            <div class="assetBox received">
                                                <h4>
                                                    Received
                                                </h4>

                                                {#if !participant.received.players.length &&
                                                     !participant.received.picks.length}
                                                    <p class="muted">
                                                        No tracked player or pick assets.
                                                    </p>
                                                {/if}

                                                {#each participant.received.players as playerID}
                                                    <div class="asset">
                                                        <span class="assetType">
                                                            PLAYER
                                                        </span>

                                                        {playerName(playerID)}
                                                    </div>
                                                {/each}

                                                {#each participant.received.picks as pick}
                                                    <div class="asset">
                                                        <span class="assetType">
                                                            PICK
                                                        </span>

                                                        {pickLabel(pick)}
                                                    </div>
                                                {/each}
                                            </div>

                                            <div class="assetBox sent">
                                                <h4>
                                                    Sent
                                                </h4>

                                                {#if !participant.sent.players.length &&
                                                     !participant.sent.picks.length}
                                                    <p class="muted">
                                                        No tracked player or pick assets.
                                                    </p>
                                                {/if}

                                                {#each participant.sent.players as playerID}
                                                    <div class="asset">
                                                        <span class="assetType">
                                                            PLAYER
                                                        </span>

                                                        {playerName(playerID)}
                                                    </div>
                                                {/each}

                                                {#each participant.sent.picks as pick}
                                                    <div class="asset">
                                                        <span class="assetType">
                                                            PICK
                                                        </span>

                                                        {pickLabel(pick)}
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    </section>
                                {/each}
                            </div>
                        {/if}
                    </article>
                {/each}
            </div>
        {/if}
    </section>


    <section class="nextStep">
        <h2>
            What this proves
        </h2>

        <p>
            Once the rows and pick resolutions above look
            correct, the next build will turn this same
            ledger into recursive franchise-specific asset
            trees. No trade ratings will be assigned until
            those trees are verified.
        </p>
    </section>
</div>


<style>
    .page {
        width: min(1500px, 96%);
        margin: 0 auto;
        padding: 28px 0 60px;
    }


    .intro {
        margin-bottom: 24px;
    }


    .eyebrow {
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
    }


    h1 {
        margin: 4px 0 8px;
    }


    .intro p,
    .panelHeader p,
    .nextStep p {
        max-width: 900px;
        margin: 0;
        line-height: 1.55;
        opacity: 0.82;
    }


    .summaryGrid {
        display: grid;
        grid-template-columns:
            repeat(
                4,
                minmax(
                    0,
                    1fr
                )
            );
        gap: 12px;
        margin-bottom: 18px;
    }


    .summaryCard,
    .panel,
    .nextStep {
        border: 1px solid rgba(127, 127, 127, 0.28);
        border-radius: 12px;
        background: rgba(127, 127, 127, 0.07);
    }


    .summaryCard {
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }


    .summaryValue {
        font-size: 2rem;
        font-weight: 800;
    }


    .summaryLabel {
        font-size: 0.88rem;
        opacity: 0.72;
    }


    .panel {
        padding: 18px;
        margin-top: 18px;
    }


    .panelHeader {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
        margin-bottom: 16px;
    }


    .panelHeader h2,
    .nextStep h2 {
        margin: 0 0 5px;
    }


    .validationTableWrap {
        width: 100%;
        overflow-x: auto;
    }


    .validationTable {
        width: 100%;
        border-collapse: collapse;
        min-width: 1000px;
    }


    .validationTable th,
    .validationTable td {
        padding: 9px 10px;
        text-align: left;
        border-bottom: 1px solid rgba(127, 127, 127, 0.2);
        white-space: nowrap;
    }


    .validationTable th {
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.7;
    }


    .yes {
        font-weight: 800;
    }


    .no {
        opacity: 0.52;
    }


    .filter {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        white-space: nowrap;
    }


    .tradeList {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }


    .tradeCard {
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 10px;
        overflow: hidden;
    }


    .tradeTitle {
        width: 100%;
        border: 0;
        background: transparent;
        color: inherit;
        padding: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        text-align: left;
        gap: 14px;
    }


    .tradeTitle:hover {
        background: rgba(127, 127, 127, 0.08);
    }


    .tradeNumber {
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        font-weight: 800;
        opacity: 0.55;
        margin-bottom: 2px;
    }


    .tradeMeta {
        display: block;
        margin-top: 3px;
        font-size: 0.82rem;
        opacity: 0.68;
    }


    .eligible,
    .notEligible {
        border-radius: 999px;
        padding: 5px 8px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        white-space: nowrap;
    }


    .eligible {
        border: 1px solid currentColor;
    }


    .notEligible {
        border: 1px solid rgba(127, 127, 127, 0.45);
        opacity: 0.55;
    }


    .participantGrid {
        display: grid;
        grid-template-columns:
            repeat(
                auto-fit,
                minmax(
                    310px,
                    1fr
                )
            );
        gap: 12px;
        padding: 0 14px 14px;
    }


    .participant {
        border-top: 1px solid rgba(127, 127, 127, 0.2);
        padding-top: 12px;
    }


    .participant h3 {
        margin: 0 0 10px;
    }


    .assetColumns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }


    .assetBox {
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 8px;
        padding: 10px;
    }


    .assetBox h4 {
        margin: 0 0 8px;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        opacity: 0.7;
    }


    .asset {
        padding: 7px 0;
        border-top: 1px solid rgba(127, 127, 127, 0.12);
        line-height: 1.35;
    }


    .asset:first-of-type {
        border-top: 0;
    }


    .assetType {
        display: block;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        opacity: 0.5;
    }


    .muted,
    .empty {
        opacity: 0.62;
    }


    .empty {
        padding: 18px 0;
    }


    .nextStep {
        margin-top: 18px;
        padding: 18px;
    }


    @media (
        max-width:
            900px
    ) {
        .summaryGrid {
            grid-template-columns:
                1fr 1fr;
        }


        .tradeHeader {
            flex-direction: column;
        }
    }


    @media (
        max-width:
            600px
    ) {
        .page {
            width: 94%;
        }


        .summaryGrid {
            grid-template-columns:
                1fr;
        }


        .assetColumns {
            grid-template-columns:
                1fr;
        }


        .tradeTitle {
            align-items: flex-start;
        }
    }
</style>
