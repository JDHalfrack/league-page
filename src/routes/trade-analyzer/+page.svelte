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


    const comparisonText =
        trade => {

            const comparison =
                trade
                    ?.comparison;


            if (!comparison) {
                return '';
            }


            if (
                comparison.label ===
                    'EVEN'
            ) {
                return 'EVEN';
            }


            if (
                comparison
                    .leaderTeamNames
                    ?.length
            ) {
                return (
                    `${comparison.label} — ` +
                    `${comparison.leaderTeamNames[0]}`
                );
            }


            return comparison.label;
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
            Phase 5: What We Know Now
        </h1>

        <p>
            Every eligible trade side now receives a 0–100
            What We Know Now score based on where its complete
            realized Positional Value ranks against all other
            eligible trade sides in league history. The lineage
            still shows the raw points and player-level positional
            normalization that produced the final return.
        </p>
    </section>


    <section class="summaryGrid">
        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.scoredTradeSides ?? 0}
            </span>

            <span class="summaryLabel">
                Scored Trade Sides
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.averageWhatWeKnowNow ?? 0}
            </span>

            <span class="summaryLabel">
                Average WWKN Score
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {(diagnostics?.summary?.positionalValueUnits ?? 0).toLocaleString(
                    'en-US',
                    {
                        maximumFractionDigits: 2
                    }
                )}
            </span>

            <span class="summaryLabel">
                Positional Value Units
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {diagnostics?.summary?.normalizedPlayerStints ?? 0}
            </span>

            <span class="summaryLabel">
                Normalized Player Stints
            </span>
        </div>

        <div class="summaryCard">
            <span class="summaryValue">
                {(diagnostics?.summary?.realizedRosterPoints ?? 0).toLocaleString(
                    'en-US',
                    {
                        maximumFractionDigits: 1
                    }
                )}
            </span>

            <span class="summaryLabel">
                Rostered Points Traced
            </span>
        </div>

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
                    Historical matchup coverage remains
                    visible because each completed week's
                    Sleeper matchup `players` list is the
                    active-rostered positional comparison pool.
                    Future current-season matchup placeholders
                    are ignored.
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
                        <th>Weeks</th>
                        <th>players_points</th>
                        <th>Missing Point Weeks</th>
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
                                {validation.matchup.weeksWithRows ?? 0}
                            </td>

                            <td>
                                {validation.matchup.hasPlayersPoints
                                    ? `YES (${validation.matchup.playersPointsType})`
                                    : 'NO'}
                            </td>

                            <td>
                                {validation.matchup.missingPointWeeks ?? 0}
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

                            <div class="tradeBadges">
                                {#if trade.eligible && trade.comparison}
                                    <span class="comparisonBadge">
                                        {comparisonText(trade)}
                                    </span>
                                {/if}

                                <span
                                    class:eligible={trade.eligible}
                                    class:notEligible={!trade.eligible}
                                >
                                    {trade.eligible
                                        ? 'ELIGIBLE'
                                        : 'TOO RECENT'}
                                </span>
                            </div>
                        </button>


                        {#if expandedTradeID === trade.id}
                            <div class="participantGrid">
                                {#each trade.participants as participant}
                                    <section class="participant">
                                        <h3>
                                            {participant.team.name}
                                        </h3>

                                        {#if participant.whatWeKnowNow}
                                            <div class="wwknBox">
                                                <span class="wwknLabel">
                                                    What We Know Now
                                                </span>

                                                <strong class="wwknScore">
                                                    {participant.whatWeKnowNow.score}
                                                    <span>/100</span>
                                                </strong>

                                                <span class="wwknMeta">
                                                    Historical return rank
                                                    {participant.whatWeKnowNow.historicalRank}
                                                    of
                                                    {participant.whatWeKnowNow.poolSize}
                                                    trade sides
                                                </span>
                                            </div>
                                        {/if}

                                        <div class="realizedBox">
                                            <span class="realizedLabel">
                                                Realized lineage production
                                            </span>

                                            <strong class="realizedValue">
                                                {(participant.realizedProduction?.points ?? 0).toLocaleString(
                                                    'en-US',
                                                    {
                                                        maximumFractionDigits: 2
                                                    }
                                                )}
                                                pts
                                            </strong>

                                            <div class="valueLine">
                                                <span>
                                                    Positional Value
                                                </span>

                                                <strong>
                                                    {(participant.realizedProduction?.positionalValue ?? 0).toLocaleString(
                                                        'en-US',
                                                        {
                                                            maximumFractionDigits: 3
                                                        }
                                                    )}
                                                </strong>
                                            </div>

                                            <span class="realizedMeta">
                                                {participant.realizedProduction?.rosteredWeeks ?? 0}
                                                rostered player-weeks
                                                ·
                                                {participant.realizedProduction?.uniquePlayers ?? 0}
                                                players
                                                ·
                                                {participant.realizedProduction?.normalizedPlayerStints ?? 0}
                                                normalized stints
                                            </span>
                                        </div>

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

                                            <div class="lineageLegend">
                                                <span class="legendItem legend1">
                                                    1 Direct
                                                </span>
                                                <span class="legendItem legend2">
                                                    2 Second
                                                </span>
                                                <span class="legendItem legend3">
                                                    3 Third
                                                </span>
                                                <span class="legendItem legend4">
                                                    4 Fourth
                                                </span>
                                                <span class="legendItem legend5">
                                                    5 Fifth
                                                </span>
                                                <span class="legendItem legendDeep">
                                                    6+ Deeper
                                                </span>
                                            </div>

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
            Phase 5 methodology
        </h2>

        <p>
            The What We Know Now score is the historical
            percentile of a complete trade side's Positional
            Value among all eligible trade sides. Scores are
            independent rather than zero-sum. Comparative labels
            use score gaps: 0–5 EVEN, over 5–15 SLIGHT EDGE,
            over 15–30 CLEAR WIN, and over 30 LANDSLIDE.
            Lineage shading shows how far each asset sits from
            the original trade: blue, green, yellow, orange,
            red, then white for level six and beyond.
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
                11,
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


    .tradeBadges {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 7px;
        flex-wrap: wrap;
    }


    .comparisonBadge {
        border: 1px solid rgba(127, 127, 127, 0.45);
        border-radius: 999px;
        padding: 5px 8px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.035em;
        white-space: nowrap;
    }


    .wwknBox {
        border: 1px solid rgba(127, 127, 127, 0.32);
        border-radius: 10px;
        padding: 12px;
        margin: 8px 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        background: rgba(127, 127, 127, 0.1);
    }


    .wwknLabel {
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.065em;
        opacity: 0.64;
    }


    .wwknScore {
        font-size: 2rem;
        line-height: 1.05;
    }


    .wwknScore span {
        font-size: 0.95rem;
        opacity: 0.6;
    }


    .wwknMeta {
        margin-top: 3px;
        font-size: 0.77rem;
        opacity: 0.68;
    }


    .lineageLegend {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin: 0 0 8px;
    }


    .legendItem {
        border: 1px solid rgba(80, 80, 80, 0.18);
        border-radius: 999px;
        padding: 3px 7px;
        color: #1f2937;
        font-size: 0.66rem;
        font-weight: 700;
    }


    .legend1 {
        background: #e8f2ff;
    }


    .legend2 {
        background: #e9f8ed;
    }


    .legend3 {
        background: #fff8d9;
    }


    .legend4 {
        background: #fff0df;
    }


    .legend5 {
        background: #fde8e8;
    }


    .legendDeep {
        background: #ffffff;
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


    .realizedBox {
        border: 1px solid rgba(127, 127, 127, 0.28);
        border-radius: 9px;
        padding: 12px;
        margin: 8px 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
        background: rgba(127, 127, 127, 0.08);
    }


    .realizedLabel {
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        opacity: 0.62;
    }


    .realizedValue {
        font-size: 1.55rem;
        line-height: 1.1;
    }


    .valueLine {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-top: 5px;
        padding-top: 5px;
        border-top: 1px solid rgba(127, 127, 127, 0.18);
    }


    .valueLine span {
        font-size: 0.76rem;
        opacity: 0.72;
    }


    .valueLine strong {
        font-size: 1.05rem;
    }


    .realizedMeta {
        font-size: 0.77rem;
        opacity: 0.68;
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
