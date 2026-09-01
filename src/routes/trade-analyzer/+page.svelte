<script>
    import TradeLineageNode
        from '$lib/TradeAnalyzer/TradeLineageNode.svelte';


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


            return (
                [
                    player.fn,
                    player.ln
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        ' '
                    ) ||
                `Player ${playerID}`
            );
        };


    const rawAssetLabel =
        asset => {

            if (
                asset.assetType ===
                'player'
            ) {
                return playerName(
                    asset.playerID
                );
            }


            if (
                asset.assetType ===
                'pick'
            ) {
                const base =
                    (
                        `${asset.season} Round ${asset.round} ` +
                        `(original roster ${asset.originalRosterID})`
                    );


                if (
                    asset
                        ?.resolved
                        ?.selectedPlayerID
                ) {
                    return (
                        `${base} → ` +
                        `${playerName(
                            asset
                                .resolved
                                .selectedPlayerID
                        )}`
                    );
                }


                return base;
            }


            if (
                asset.assetType ===
                'budget'
            ) {
                return (
                    `$${asset.amount} FAAB`
                );
            }


            return 'Unknown asset';
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
        Historical Trade Analyzer
    </title>
</svelte:head>


<div class="page">
    <section class="intro">
        <div class="eyebrow">
            Historical Trade Analyzer
        </div>

        <h1>
            Phase 2: Asset Lineage
        </h1>

        <p>
            Every received player and draft pick is now
            followed forward. Drops end a branch. Retrades
            continue into the assets received in return.
            Draft picks convert into the player actually
            selected and that player then continues through
            the same lineage rules.
        </p>
    </section>


    <section class="summaryGrid">
        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.eligibleTrades ?? 0}
            </span>

            <span class="summaryLabel">
                Eligible Trades
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.lineageNodes ?? 0}
            </span>

            <span class="summaryLabel">
                Lineage Nodes
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.lineageRetrades ?? 0}
            </span>

            <span class="summaryLabel">
                Retrade Events
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.lineageDrops ?? 0}
            </span>

            <span class="summaryLabel">
                Branches Ended by Drop
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.lineageStillHeld ?? 0}
            </span>

            <span class="summaryLabel">
                Still Held
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.unresolvedDispositions ?? 0}
            </span>

            <span class="summaryLabel">
                Need Review
            </span>
        </div>
    </section>


    <section class="panel">
        <div class="panelHeader">
            <div>
                <h2>
                    Source Validation
                </h2>

                <p>
                    Phase 1 checks remain visible so any
                    suspicious lineage can be traced back to
                    its archived Sleeper source.
                </p>
            </div>
        </div>


        <div class="validationTableWrap">
            <table class="validationTable">
                <thead>
                    <tr>
                        <th>Season</th>
                        <th>Trades</th>
                        <th>Drops</th>
                        <th>Pick Moves</th>
                        <th>Drafts</th>
                        <th>players_points</th>
                        <th>starters_points</th>
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
                                {validation.matchup.hasPlayersPoints
                                    ? `YES (${validation.matchup.playersPointsType})`
                                    : 'NO'}
                            </td>

                            <td>
                                {validation.matchup.hasStartersPoints
                                    ? `YES (${validation.matchup.startersPointsType})`
                                    : 'NO'}
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
                    Trade Lineages
                </h2>

                <p>
                    Expand a trade. Each participant gets a
                    separate franchise-specific tree showing
                    what happened to the assets they received.
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

                            <span
                                class:eligible={trade.eligible}
                                class:notEligible={!trade.eligible}
                            >
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

                                        <div class="sentBox">
                                            <h4>
                                                Gave Up
                                            </h4>

                                            {#if !participant.sent.length}
                                                <div class="muted">
                                                    No tracked player, pick or FAAB assets.
                                                </div>
                                            {:else}
                                                {#each participant.sent as asset}
                                                    <div class="rawAsset">
                                                        {rawAssetLabel(asset)}
                                                    </div>
                                                {/each}
                                            {/if}
                                        </div>


                                        <div class="lineageBox">
                                            <h4>
                                                Received & What Happened
                                            </h4>

                                            {#if !participant.receivedLineages.length}
                                                <div class="muted">
                                                    No tracked received assets.
                                                </div>
                                            {:else}
                                                {#each participant.receivedLineages as lineage}
                                                    <TradeLineageNode
                                                        node={lineage}
                                                        {players}
                                                    />
                                                {/each}
                                            {/if}
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
            Phase 2 checkpoint
        </h2>

        <p>
            The important test now is historical accuracy:
            a received player should terminate when that
            franchise dropped him, continue when retained,
            and branch into the correct return when retraded.
            A received draft pick should either be retraded
            or become the correct drafted player. Once these
            trees are verified, the next phase can attach
            realized fantasy production to every player node
            and then build the What We Know Now rating.
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
        max-width: 950px;
        margin: 0;
        line-height: 1.55;
        opacity: 0.82;
    }


    .summaryGrid {
        display: grid;
        grid-template-columns:
            repeat(
                6,
                minmax(
                    0,
                    1fr
                )
            );
        gap: 10px;
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
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }


    .summaryValue {
        font-size: 1.8rem;
        font-weight: 800;
    }


    .summaryLabel {
        font-size: 0.78rem;
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
        min-width: 850px;
    }


    .validationTable th,
    .validationTable td {
        padding: 9px 10px;
        text-align: left;
        border-bottom: 1px solid rgba(127, 127, 127, 0.2);
        white-space: nowrap;
    }


    .validationTable th {
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.7;
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
                    340px,
                    1fr
                )
            );
        gap: 14px;
        padding: 0 14px 14px;
    }


    .participant {
        border-top: 1px solid rgba(127, 127, 127, 0.2);
        padding-top: 12px;
        min-width: 0;
    }


    .participant h3 {
        margin: 0 0 10px;
        font-size: 1.45rem;
    }


    .sentBox,
    .lineageBox {
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 9px;
        padding: 11px;
        margin-top: 8px;
    }


    .sentBox h4,
    .lineageBox h4 {
        margin: 0 0 8px;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        opacity: 0.68;
    }


    .rawAsset {
        padding: 7px 0;
        border-top: 1px solid rgba(127, 127, 127, 0.14);
        line-height: 1.35;
    }


    .rawAsset:first-of-type {
        border-top: 0;
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
            1150px
    ) {
        .summaryGrid {
            grid-template-columns:
                repeat(
                    3,
                    1fr
                );
        }
    }


    @media (
        max-width:
            800px
    ) {
        .tradeHeader {
            flex-direction: column;
        }


        .summaryGrid {
            grid-template-columns:
                repeat(
                    2,
                    1fr
                );
        }
    }


    @media (
        max-width:
            520px
    ) {
        .page {
            width: 94%;
        }


        .summaryGrid {
            grid-template-columns:
                1fr;
        }


        .participantGrid {
            grid-template-columns:
                1fr;
        }


        .tradeTitle {
            align-items: flex-start;
        }
    }
</style>
