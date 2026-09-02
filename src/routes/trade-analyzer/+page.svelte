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


    const maxLineageLevel =
        roots => {

            let maxLevel =
                0;


            const visit =
                (
                    node,
                    level
                ) => {

                    if (!node) {
                        return;
                    }


                    maxLevel =
                        Math.max(
                            maxLevel,
                            level
                        );


                    for (
                        const child
                        of node.children ||
                        []
                    ) {
                        visit(
                            child,
                            level + 1
                        );
                    }
                };


            for (
                const root
                of roots ||
                []
            ) {
                visit(
                    root,
                    1
                );
            }


            return maxLevel;
        };


    const lineageLegend =
        roots => {

            const maxLevel =
                maxLineageLevel(
                    roots
                );


            const items =
                [];


            const add =
                (
                    level,
                    label,
                    className
                ) => {

                    if (
                        maxLevel >=
                        level
                    ) {
                        items.push({
                            level,
                            label,
                            className
                        });
                    }
                };


            add(
                1,
                'Direct',
                'legend1'
            );


            add(
                2,
                '2nd level',
                'legend2'
            );


            add(
                3,
                '3rd level',
                'legend3'
            );


            add(
                4,
                '4th level',
                'legend4'
            );


            add(
                5,
                '5th level',
                'legend5'
            );


            add(
                6,
                '6th+ level',
                'legendDeep'
            );


            return items;
        };


    const participantSummary =
        participant => {

            const wwkn =
                participant
                    ?.whatWeKnowNow;


            const realized =
                participant
                    ?.realizedProduction ||
                {};


            return {
                team:
                    participant
                        ?.team
                        ?.name ||
                    `Roster ${participant?.rosterID}`,

                score:
                    wwkn
                        ?.score ??
                    null,

                rank:
                    wwkn
                        ?.historicalRank ??
                    null,

                rankPool:
                    wwkn
                        ?.poolSize ??
                    null,

                points:
                    realized
                        ?.points ??
                    0,

                positionalValue:
                    realized
                        ?.positionalValue ??
                    0
            };
        };


    const tradeTeamsText =
        trade => {

            return (
                trade
                    ?.participants ||
                []
            )
                .map(
                    participant =>
                        participant
                            ?.team
                            ?.name ||
                        `Roster ${participant?.rosterID}`
                )
                .join(
                    ' ↔ '
                );
        };


    $:
        topLopsidedTrades =
            (
                diagnostics
                    ?.eligibleTrades ||
                []
            )
                .filter(
                    trade =>
                        Number.isFinite(
                            Number(
                                trade
                                    ?.comparison
                                    ?.scoreGap
                            )
                        )
                )
                .slice()
                .sort(
                    (
                        a,
                        b
                    ) =>
                        Number(
                            b
                                ?.comparison
                                ?.scoreGap
                        ) -
                        Number(
                            a
                                ?.comparison
                                ?.scoreGap
                        )
                )
                .slice(
                    0,
                    10
                );


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
            What We Know Now
        </h1>

        <p>
            Each eligible trade side receives a 0–100 score
            based on how its complete realized Positional Value
            ranks against every other eligible trade side in
            league history. Open any trade below to inspect the
            full asset lineage, player production and positional
            normalization that produced the score.
        </p>
    </section>


    <section class="panel topTradesPanel">
        <div class="panelHeader">
            <div>
                <h2>
                    Top 10 Most Lopsided Trades
                </h2>

                <p>
                    Ranked by the gap between the highest and
                    second-highest What We Know Now scores in
                    each eligible trade.
                </p>
            </div>
        </div>


        {#if !topLopsidedTrades.length}
            <div class="empty">
                No eligible scored trades are available.
            </div>
        {:else}
            <div class="topTradeTableWrap">
                <table class="topTradeTable">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th>Trade</th>
                            <th>Result</th>
                            <th>Score Gap</th>
                            <th>Team Returns</th>
                        </tr>
                    </thead>

                    <tbody>
                        {#each topLopsidedTrades as trade, index}
                            <tr>
                                <td class="rankCell">
                                    {index + 1}
                                </td>

                                <td class="dateCell">
                                    <strong>
                                        {formatDate(trade.date)}
                                    </strong>

                                    <span>
                                        {trade.season}
                                    </span>
                                </td>

                                <td class="teamsCell">
                                    {tradeTeamsText(trade)}
                                </td>

                                <td>
                                    <span class="comparisonBadge">
                                        {comparisonText(trade)}
                                    </span>
                                </td>

                                <td class="gapCell">
                                    {trade.comparison?.scoreGap ?? 0}
                                </td>

                                <td>
                                    <div class="tableReturns">
                                        {#each trade.participants as participant}
                                            {@const summary = participantSummary(participant)}

                                            <div class="tableReturn">
                                                <strong class="tableTeam">
                                                    {summary.team}
                                                </strong>

                                                <span>
                                                    WWKN
                                                    <strong>
                                                        {summary.score ?? '—'}
                                                    </strong>
                                                    /100
                                                </span>

                                                <span>
                                                    Return rank
                                                    <strong>
                                                        {summary.rank ?? '—'}
                                                    </strong>
                                                    /{summary.rankPool ?? '—'}
                                                </span>

                                                <span>
                                                    Production
                                                    <strong>
                                                        {Number(summary.points).toLocaleString(
                                                            'en-US',
                                                            {
                                                                maximumFractionDigits: 2
                                                            }
                                                        )}
                                                    </strong>
                                                    pts
                                                </span>

                                                <span>
                                                    Positional Value
                                                    <strong>
                                                        {Number(summary.positionalValue).toLocaleString(
                                                            'en-US',
                                                            {
                                                                maximumFractionDigits: 3
                                                            }
                                                        )}
                                                    </strong>
                                                </span>
                                            </div>
                                        {/each}
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </section>


    <section class="panel">
        <div class="panelHeader tradeHeader">
            <div>
                <h2>
                    Trade Lineages
                </h2>

                <p>
                    Each bar previews the participants and
                    their final return metrics. Open it for the
                    complete franchise-specific asset trees.
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
                            <div class="tradePreviewMain">
                                <div class="tradePreviewIdentity">
                                    <span class="tradeNumber">
                                        Trade {index + 1}
                                    </span>

                                    <strong class="tradePreviewTeams">
                                        {tradeTeamsText(trade)}
                                    </strong>

                                    <span class="tradeMeta">
                                        {formatDate(trade.date)}
                                        ·
                                        {trade.season}
                                        ·
                                        Sleeper round {trade.sourceRound}
                                    </span>
                                </div>

                                <div class="tradePreviewReturns">
                                    {#each trade.participants as participant}
                                        {@const summary = participantSummary(participant)}

                                        <div class="previewReturn">
                                            <strong>
                                                {summary.team}
                                            </strong>

                                            <span>
                                                WWKN {summary.score ?? '—'}/100
                                            </span>

                                            <span>
                                                Rank {summary.rank ?? '—'}/{summary.rankPool ?? '—'}
                                            </span>

                                            <span>
                                                {Number(summary.points).toLocaleString(
                                                    'en-US',
                                                    {
                                                        maximumFractionDigits: 1
                                                    }
                                                )} pts
                                            </span>

                                            <span>
                                                PV {Number(summary.positionalValue).toLocaleString(
                                                    'en-US',
                                                    {
                                                        maximumFractionDigits: 2
                                                    }
                                                )}
                                            </span>
                                        </div>
                                    {/each}
                                </div>
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

                                            {#if participant.receivedLineages.length}
                                                <div class="lineageLegend">
                                                    {#each lineageLegend(participant.receivedLineages) as item}
                                                        <span class={`legendItem ${item.className}`}>
                                                            {item.label}
                                                        </span>
                                                    {/each}
                                                </div>
                                            {/if}

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
            How the score works
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


    .topTradeTableWrap {
        width: 100%;
        overflow-x: auto;
    }


    .topTradeTable {
        width: 100%;
        border-collapse: collapse;
        min-width: 1050px;
    }


    .topTradeTable th,
    .topTradeTable td {
        padding: 10px 11px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid rgba(127, 127, 127, 0.2);
    }


    .topTradeTable th {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.055em;
        opacity: 0.65;
    }


    .rankCell,
    .gapCell {
        font-size: 1.05rem;
        font-weight: 800;
        white-space: nowrap;
    }


    .dateCell {
        white-space: nowrap;
    }


    .dateCell span {
        display: block;
        margin-top: 2px;
        font-size: 0.76rem;
        opacity: 0.62;
    }


    .teamsCell {
        min-width: 190px;
        font-weight: 700;
    }


    .tableReturns {
        display: grid;
        grid-template-columns:
            repeat(
                auto-fit,
                minmax(
                    185px,
                    1fr
                )
            );
        gap: 7px;
        min-width: 390px;
    }


    .tableReturn {
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 7px;
        padding: 7px 8px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.73rem;
    }


    .tableTeam {
        font-size: 0.82rem;
        margin-bottom: 2px;
    }


    .tradePreviewMain {
        min-width: 0;
        flex: 1;
        display: grid;
        grid-template-columns:
            minmax(
                190px,
                0.8fr
            )
            minmax(
                380px,
                2fr
            );
        gap: 14px;
        align-items: center;
    }


    .tradePreviewIdentity {
        min-width: 0;
    }


    .tradePreviewTeams {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }


    .tradePreviewReturns {
        display: grid;
        grid-template-columns:
            repeat(
                auto-fit,
                minmax(
                    175px,
                    1fr
                )
            );
        gap: 6px;
    }


    .previewReturn {
        border-left: 2px solid rgba(127, 127, 127, 0.28);
        padding-left: 8px;
        display: grid;
        grid-template-columns:
            repeat(
                2,
                auto
            );
        gap: 1px 9px;
        align-items: baseline;
        font-size: 0.72rem;
        opacity: 0.86;
    }


    .previewReturn strong {
        grid-column: 1 / -1;
        font-size: 0.79rem;
        opacity: 1;
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


    @media (max-width: 1050px) {
        .tradePreviewMain {
            grid-template-columns:
                1fr;
        }
    }


    @media (max-width: 720px) {
        .tradeTitle {
            align-items: flex-start;
            flex-direction: column;
        }


        .tradeBadges {
            width: 100%;
            justify-content: flex-start;
        }


        .tradePreviewReturns {
            grid-template-columns:
                1fr;
        }
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
