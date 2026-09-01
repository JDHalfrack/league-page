<script>
    export let node;
    export let players = {};
    export let depth = 0;


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


    const assetTitle =
        item => {

            if (
                item.assetType ===
                'player'
            ) {
                return playerName(
                    item.playerID
                );
            }


            if (
                item.assetType ===
                'pick'
            ) {
                return (
                    `${item.season} Round ${item.round} ` +
                    `(original roster ${item.originalRosterID})`
                );
            }


            if (
                item.assetType ===
                'budget'
            ) {
                return (
                    `$${item.amount} FAAB`
                );
            }


            return 'Unknown asset';
        };


    const formatSigned =
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
                return '—';
            }


            return (
                `${number >= 0 ? '+' : ''}` +
                `${number.toLocaleString(
                    'en-US',
                    {
                        maximumFractionDigits:
                            2
                    }
                )}`
            );
        };


    const lineageLevel =
        depth +
        1;


    const levelClass =
        depth === 0
            ? 'level1'
            : depth === 1
                ? 'level2'
                : depth === 2
                    ? 'level3'
                    : depth === 3
                        ? 'level4'
                        : depth === 4
                            ? 'level5'
                            : 'levelDeep';


    const detail =
        item => {

            if (
                item.status ===
                    'USED' &&
                item.selectedPlayerID
            ) {
                return (
                    `Drafted ${playerName(
                        item.selectedPlayerID
                    )}`
                );
            }


            if (
                item.status ===
                    'TRADED' &&
                item.replacementAssets
            ) {
                return (
                    `Returned ${item.replacementAssets} tracked ` +
                    `${item.replacementAssets === 1 ? 'asset' : 'assets'}`
                );
            }


            if (
                item.status ===
                    'TRADED - SHARED CONTINUATION'
            ) {
                return (
                    'This asset was bundled into a trade whose ' +
                    'return is already shown on another branch.'
                );
            }


            if (
                item.status ===
                    'USED BY DIFFERENT ROSTER'
            ) {
                return (
                    `Draft record shows roster ` +
                    `${item.selectedByRosterID} made the selection.`
                );
            }


            return '';
        };
</script>


<div
    class="node"
    style={`--depth:${depth}`}
>
    <div class="connector"></div>

    <div class={`nodeBody ${levelClass}`}>
        <div class="assetType">
            {node.assetType}
            ·
            Lineage level {lineageLevel}
        </div>

        <div class="title">
            {assetTitle(node)}
        </div>

        <div class="status">
            {node.status}
        </div>

        {#if node.assetType === 'player' && node.production}
            <div class="production">
                <div class="productionPrimary">
                    <strong>
                        {node.production.points.toLocaleString(
                            'en-US',
                            {
                                maximumFractionDigits: 2
                            }
                        )}
                    </strong>
                    rostered points
                    ·
                    {node.production.rosteredWeeks}
                    rostered weeks
                </div>

                {#if node.production.positionScore !== null
                    && node.production.positionScore !== undefined}
                    <div class="positionGrid">
                        <div class="positionStat">
                            <span>
                                Position
                            </span>

                            <strong>
                                {node.production.position}
                            </strong>
                        </div>

                        <div class="positionStat">
                            <span>
                                Position Score
                            </span>

                            <strong>
                                {node.production.positionScore}
                                /100
                            </strong>
                        </div>

                        <div class="positionStat">
                            <span>
                                Rank
                            </span>

                            <strong>
                                {node.production.positionRank}
                                /{node.production.positionPool}
                            </strong>
                        </div>

                        <div class="positionStat">
                            <span>
                                Positional Value
                            </span>

                            <strong>
                                {node.production.positionalValue}
                            </strong>
                        </div>
                    </div>

                    <div class="comparison">
                        Same {node.production.position} comparison
                        over {node.production.comparisonWeeks} rostered weeks:
                        median {node.production.positionMedianPoints}
                        pts
                        ·
                        {formatSigned(node.production.pointsAboveMedian)}
                        vs. median
                    </div>
                {:else}
                    <div class="comparison missing">
                        Position metadata unavailable for this player;
                        raw rostered points are still preserved.
                    </div>
                {/if}

                {#if node.production.missingPointWeeks > 0}
                    <div class="comparison missing">
                        {node.production.missingPointWeeks}
                        rostered weeks are missing player-level point detail.
                    </div>
                {/if}
            </div>
        {/if}


        {#if node.disposition?.date}
            <div class="meta">
                {formatDate(node.disposition.date)}

                {#if node.disposition.transactionID}
                    · Trade/transaction {node.disposition.transactionID}
                {/if}
            </div>
        {/if}

        {#if detail(node)}
            <div class="detail">
                {detail(node)}
            </div>
        {/if}
    </div>
</div>


{#if node.children?.length}
    <div class="children">
        {#each node.children as child}
            <svelte:self
                node={child}
                {players}
                depth={depth + 1}
            />
        {/each}
    </div>
{/if}


<style>
    .node {
        position: relative;
        margin-left:
            calc(
                min(
                    var(--depth),
                    8
                ) *
                18px
            );
        padding: 7px 0;
    }


    .nodeBody {
        border: 1px solid rgba(80, 80, 80, 0.22);
        border-radius: 8px;
        padding: 10px 12px;
        color: #1f2937;
    }


    .nodeBody.level1 {
        background: #e8f2ff;
    }


    .nodeBody.level2 {
        background: #e9f8ed;
    }


    .nodeBody.level3 {
        background: #fff8d9;
    }


    .nodeBody.level4 {
        background: #fff0df;
    }


    .nodeBody.level5 {
        background: #fde8e8;
    }


    .nodeBody.levelDeep {
        background: #ffffff;
    }


    .assetType {
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.52;
    }


    .title {
        margin-top: 2px;
        font-weight: 750;
        font-size: 1rem;
    }


    .status {
        margin-top: 5px;
        display: inline-block;
        border: 1px solid rgba(127, 127, 127, 0.35);
        border-radius: 999px;
        padding: 3px 7px;
        font-size: 0.69rem;
        font-weight: 800;
        letter-spacing: 0.035em;
    }


    .production {
        margin-top: 8px;
        font-size: 0.84rem;
        line-height: 1.35;
    }


    .productionPrimary strong {
        font-size: 1.05rem;
    }


    .positionGrid {
        display: grid;
        grid-template-columns:
            repeat(
                4,
                minmax(
                    0,
                    1fr
                )
            );
        gap: 6px;
        margin-top: 8px;
    }


    .positionStat {
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 6px;
        padding: 6px 7px;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }


    .positionStat span {
        font-size: 0.63rem;
        text-transform: uppercase;
        letter-spacing: 0.045em;
        opacity: 0.55;
    }


    .positionStat strong {
        font-size: 0.9rem;
    }


    .comparison {
        margin-top: 7px;
        font-size: 0.76rem;
        opacity: 0.72;
    }


    .comparison.missing {
        opacity: 0.58;
    }


    @media (max-width: 650px) {
        .positionGrid {
            grid-template-columns:
                repeat(
                    2,
                    minmax(
                        0,
                        1fr
                    )
                );
        }
    }


    .meta {
        margin-top: 6px;
        font-size: 0.76rem;
        opacity: 0.62;
        overflow-wrap: anywhere;
    }


    .detail {
        margin-top: 6px;
        font-size: 0.82rem;
        line-height: 1.35;
        opacity: 0.78;
    }


    .children {
        position: relative;
    }


    .children::before {
        content: '';
        position: absolute;
        left: 8px;
        top: -4px;
        bottom: 12px;
        width: 1px;
        background: rgba(127, 127, 127, 0.25);
    }
</style>
