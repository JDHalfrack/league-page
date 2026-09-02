<script>
    export let data;

    $: tracker = data?.tracker || {};
    $: streaks = tracker?.streaks || [];

    let statusFilter = 'all';
    let acquisitionFilter = 'all';
    let positionFilter = 'all';
    let searchText = '';
    let visibleLimit = 100;

    const normalize = value => String(value || '').toLowerCase().trim();

    const positionOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    const comparePositions = (a, b) => {
        const aIndex = positionOrder.indexOf(a);
        const bIndex = positionOrder.indexOf(b);

        if (aIndex !== -1 || bIndex !== -1) {
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        }

        return String(a).localeCompare(String(b));
    };

    const resetVisibleLimit = () => {
        visibleLimit = 100;
    };

    const imageUrlForStreak = streak => {
        if (
            streak.position === 'DEF' &&
            streak.nflTeam
        ) {
            return `https://a.espncdn.com/i/teamlogos/nfl/500/${String(
                streak.nflTeam
            ).toLowerCase()}.png`;
        }

        return streak.photoUrl;
    };

    /*
        Only streaks longer than one recorded league week are included.
        Re-rank after removing one-week stints so the displayed ranking
        remains consecutive.
    */
    $: eligibleStreaks = streaks
        .filter(streak => Number(streak.weeks) > 1)
        .map((streak, index) => ({
            ...streak,
            displayRank: index + 1
        }));

    $: positionOptions = [
        ...new Set(
            eligibleStreaks
                .map(streak => String(streak.position || '').trim())
                .filter(Boolean)
        )
    ].sort(comparePositions);

    $: longestEligibleWeeks = eligibleStreaks[0]?.weeks || 0;
    $: activeEligibleCount = eligibleStreaks.filter(streak => streak.active).length;

    $: filteredStreaks = eligibleStreaks.filter(streak => {
        if (statusFilter === 'active' && !streak.active) return false;
        if (statusFilter === 'completed' && streak.active) return false;

        if (
            acquisitionFilter !== 'all' &&
            streak.acquisitionMethod !== acquisitionFilter
        ) {
            return false;
        }

        if (
            positionFilter !== 'all' &&
            streak.position !== positionFilter
        ) {
            return false;
        }

        const query = normalize(searchText);
        if (!query) return true;

        return (
            normalize(streak.playerName).includes(query) ||
            normalize(streak.teamName).includes(query) ||
            normalize(streak.position).includes(query)
        );
    });

    $: displayedStreaks = filteredStreaks.slice(0, visibleLimit);

    const formatDate = value => {
        if (!value) return '';

        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(value));
    };

    const acquisitionDetail = streak => {
        const parts = [];

        if (streak.acquisitionDate) {
            parts.push(formatDate(streak.acquisitionDate));
        }

        if (streak.acquisitionWeek > 0) {
            parts.push(`${streak.acquisitionSeason} Week ${streak.acquisitionWeek}`);
        } else if (streak.acquisitionSeason) {
            parts.push(`${streak.acquisitionSeason} offseason`);
        }

        return parts.join(' · ');
    };

    const endingDetail = streak => {
        if (streak.active) return 'Still active';

        const parts = [];
        if (streak.endReason) parts.push(streak.endReason);

        if (streak.endDate) {
            parts.push(formatDate(streak.endDate));
        } else if (streak.endSeason && streak.endWeek) {
            parts.push(`${streak.endSeason} Week ${streak.endWeek}`);
        } else if (streak.endSeason) {
            parts.push(String(streak.endSeason));
        }

        return parts.join(' · ');
    };
</script>

<svelte:head>
    <title>Keeper Tracker</title>
</svelte:head>

<div class="page">
    <section class="intro">
        <div class="eyebrow">USCCFFL League History</div>

        <h1>Keeper Tracker</h1>

        <p>
            This tracker ranks every continuous franchise ownership streak by actual
            USCCFFL roster weeks, including fantasy playoff weeks. A streak continues
            across the offseason without adding fake calendar weeks, and it ends the
            moment a player is dropped, traded away or otherwise leaves that franchise.
            Reacquiring or re-drafting the same player starts a brand-new streak.
        </p>

        <p>
            Each entry also shows how that specific streak began:
            <strong>Drafted</strong>, <strong>Signed</strong>, or
            <strong>Acquired via Trade</strong>. Active streaks are lightly shaded so
            records that are still growing are easy to spot. One-week stints are
            excluded from the rankings.
        </p>
    </section>

    <section class="summaryBar">
        <div>
            <span>Longest recorded streak</span>
            <strong>{longestEligibleWeeks} weeks</strong>
        </div>

        <div>
            <span>Active streaks</span>
            <strong>{activeEligibleCount}</strong>
        </div>

        <div>
            <span>Recorded streaks</span>
            <strong>{eligibleStreaks.length}</strong>
        </div>
    </section>

    <section class="controls">
        <input
            class="search"
            type="search"
            bind:value={searchText}
            oninput={resetVisibleLimit}
            placeholder="Search player or franchise"
        />

        <select
            bind:value={statusFilter}
            onchange={resetVisibleLimit}
            aria-label="Streak status"
        >
            <option value="all">All streaks</option>
            <option value="active">Active only</option>
            <option value="completed">Completed only</option>
        </select>

        <select
            bind:value={positionFilter}
            onchange={resetVisibleLimit}
            aria-label="Player position"
        >
            <option value="all">All positions</option>
            {#each positionOptions as position}
                <option value={position}>{position}</option>
            {/each}
        </select>

        <select
            bind:value={acquisitionFilter}
            onchange={resetVisibleLimit}
            aria-label="Acquisition method"
        >
            <option value="all">All acquisition methods</option>
            <option value="Drafted">Drafted</option>
            <option value="Signed">Signed</option>
            <option value="Acquired via Trade">Acquired via Trade</option>
            <option value="Acquisition unknown">Acquisition unknown</option>
        </select>
    </section>

    <section class="streakList">
        {#if !filteredStreaks.length}
            <div class="empty">No roster streaks matched those filters.</div>
        {:else}
            {#each displayedStreaks as streak}
                <article class="streakCard" class:activeStreak={streak.active}>
                    <div class="rank">#{streak.displayRank}</div>

                    <div class="playerPhoto" class:defenseLogo={streak.position === 'DEF'}>
                        <div class="photoFallback">{streak.position || 'NFL'}</div>

                        <img
                            src={imageUrlForStreak(streak)}
                            alt={streak.playerName}
                            loading="lazy"
                            onerror={(event) => {
                                event.currentTarget.style.display = 'none';
                            }}
                        />
                    </div>

                    <div class="identity">
                        <div class="nameLine">
                            <h2>{streak.playerName}</h2>

                            {#if streak.active}
                                <span class="activeBadge">ACTIVE</span>
                            {/if}
                        </div>

                        <div class="team">{streak.teamName}</div>

                        <div class="bio">
                            {#if streak.position}<span>{streak.position}</span>{/if}
                            {#if streak.nflTeam}<span>{streak.nflTeam}</span>{/if}
                            <span>Franchise roster {streak.rosterID}</span>
                        </div>
                    </div>

                    <div class="weeks">
                        <strong>{streak.weeks}</strong>
                        <span>consecutive roster weeks</span>
                    </div>

                    <div class="details">
                        <div class="detailBlock">
                            <span class="label">Acquired</span>
                            <strong>{streak.acquisitionMethod}</strong>
                            <span>{acquisitionDetail(streak)}</span>
                        </div>

                        <div class="detailBlock">
                            <span class="label">Streak</span>

                            <strong>
                                {streak.startSeason}
                                {#if streak.startWeek > 0}
                                    Week {streak.startWeek}
                                {:else}
                                    offseason
                                {/if}
                                →
                                {#if streak.active}
                                    Present
                                {:else}
                                    {streak.lastSeason}
                                    {#if streak.lastWeek}Week {streak.lastWeek}{/if}
                                {/if}
                            </strong>

                            <span>{endingDetail(streak)}</span>
                        </div>
                    </div>
                </article>
            {/each}
        {/if}
    </section>

    {#if filteredStreaks.length > 100}
        <div class="listControls">
            <span>
                Showing {Math.min(visibleLimit, filteredStreaks.length)}
                of {filteredStreaks.length} matching streaks
            </span>

            {#if visibleLimit < filteredStreaks.length}
                <button
                    type="button"
                    onclick={() => {
                        visibleLimit = filteredStreaks.length;
                    }}
                >
                    Show all {filteredStreaks.length}
                </button>
            {:else}
                <button
                    type="button"
                    onclick={() => {
                        visibleLimit = 100;
                    }}
                >
                    Show top 100
                </button>
            {/if}
        </div>
    {/if}

    <section class="methodology">
        <h2>How streaks are counted</h2>

        <p>
            Sleeper's weekly matchup roster snapshots are used as the week-by-week
            source of truth. Transaction history is layered on top so a drop, trade or
            same-season reacquisition can reset a streak even when the player appears
            on the same franchise in nearby weekly snapshots. Draft history identifies
            drafted acquisitions, transaction adds identify signings and trades, and
            the league's playoff bracket determines the final fantasy week counted each
            season.
        </p>

        <p>
            Current-season weeks are counted only after they are completed. Players who
            remain rostered during the offseason stay active, but the offseason itself
            adds zero weeks to the total. Streaks of only one recorded league week are
            omitted from this page.
        </p>
    </section>
</div>

<style>
    .page {
        width: 100%;
        max-width: 1120px;
        margin: 0 auto;
        padding: 60px 40px 90px;
        box-sizing: border-box;
        font-family: Arial, Helvetica, sans-serif;
    }

    .intro {
        max-width: 940px;
        margin-bottom: 32px;
    }

    .eyebrow {
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        opacity: 0.58;
    }

    h1 {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 4rem;
        line-height: 1.05;
        font-weight: 700;
        letter-spacing: -0.04em;
        margin: 20px 0 35px;
    }

    .intro p,
    .methodology p {
        font-size: 1.05rem;
        line-height: 1.65;
        margin: 0 0 15px;
    }

    .summaryBar {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1px;
        overflow: hidden;
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 10px;
        margin: 28px 0 18px;
        background: rgba(127, 127, 127, 0.16);
    }

    .summaryBar > div {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 15px 18px;
        background: var(--fff);
    }

    .summaryBar span {
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.58;
    }

    .summaryBar strong {
        font-size: 1.25rem;
    }

    .controls {
        display: grid;
        grid-template-columns: minmax(230px, 1fr) 155px 145px 205px;
        gap: 9px;
        margin-bottom: 18px;
    }

    .controls input,
    .controls select {
        box-sizing: border-box;
        width: 100%;
        min-height: 42px;
        border: 1px solid rgba(127, 127, 127, 0.35);
        border-radius: 8px;
        padding: 8px 11px;
        color: inherit;
        background: var(--fff);
        font: inherit;
    }

    .streakList {
        display: flex;
        flex-direction: column;
        gap: 9px;
    }

    .streakCard {
        display: grid;
        grid-template-columns: 50px 74px minmax(190px, 1fr) 125px minmax(310px, 1.25fr);
        gap: 14px;
        align-items: center;
        padding: 13px 15px;
        border: 1px solid rgba(127, 127, 127, 0.22);
        border-radius: 11px;
        background: var(--fff);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .streakCard.activeStreak {
        background: #edf8f0;
        border-color: #b9dcc2;
    }

    .rank {
        text-align: center;
        font-size: 0.9rem;
        font-weight: 800;
        line-height: 1;
        opacity: 0.58;
        white-space: nowrap;
    }

    .playerPhoto {
        position: relative;
        width: 70px;
        height: 70px;
        border-radius: 50%;
        overflow: hidden;
        background: #e7e7e7;
        border: 1px solid rgba(127, 127, 127, 0.25);
    }

    .playerPhoto img,
    .photoFallback {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    .playerPhoto img {
        object-fit: cover;
        z-index: 2;
    }

    .playerPhoto.defenseLogo img {
        object-fit: contain;
        box-sizing: border-box;
        padding: 8px;
    }

    .photoFallback {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 800;
        opacity: 0.5;
    }

    .nameLine {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 7px;
    }

    .identity h2 {
        margin: 0;
        font-size: 1.15rem;
        line-height: 1.15;
    }

    .team {
        margin-top: 4px;
        font-size: 0.9rem;
        font-weight: 700;
    }

    .bio {
        display: flex;
        flex-wrap: wrap;
        gap: 5px 9px;
        margin-top: 5px;
        font-size: 0.74rem;
        opacity: 0.62;
    }

    .activeBadge {
        display: inline-flex;
        align-items: center;
        padding: 3px 6px;
        border-radius: 999px;
        background: #d4efdb;
        color: #216b35;
        font-size: 0.65rem;
        font-weight: 900;
        letter-spacing: 0.06em;
    }

    .weeks {
        display: flex;
        flex-direction: column;
        text-align: center;
    }

    .weeks strong {
        font-size: 2rem;
        line-height: 1;
    }

    .weeks span {
        margin-top: 4px;
        font-size: 0.7rem;
        line-height: 1.15;
        opacity: 0.58;
    }

    .details {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }

    .detailBlock {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
        padding: 9px 10px;
        border-radius: 8px;
        background: rgba(127, 127, 127, 0.07);
    }

    .activeStreak .detailBlock {
        background: rgba(255, 255, 255, 0.58);
    }

    .detailBlock .label {
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.055em;
        text-transform: uppercase;
        opacity: 0.5;
    }

    .detailBlock strong {
        font-size: 0.82rem;
    }

    .detailBlock > span:last-child {
        font-size: 0.7rem;
        line-height: 1.25;
        opacity: 0.64;
    }

    .listControls {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 22px;
        font-size: 0.8rem;
    }

    .listControls span {
        opacity: 0.62;
    }

    .listControls button {
        min-height: 38px;
        padding: 8px 14px;
        border: 1px solid rgba(127, 127, 127, 0.35);
        border-radius: 8px;
        background: var(--fff);
        color: inherit;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
    }

    .listControls button:hover {
        background: rgba(127, 127, 127, 0.08);
    }

    .methodology {
        margin-top: 46px;
        padding-top: 28px;
        border-top: 1px solid rgba(127, 127, 127, 0.22);
        max-width: 900px;
    }

    .methodology h2 {
        font-size: 2.1rem;
        line-height: 1.1;
        letter-spacing: -0.025em;
        margin: 0 0 18px;
    }

    .empty {
        padding: 24px;
        text-align: center;
        border: 1px dashed rgba(127, 127, 127, 0.3);
        border-radius: 10px;
        opacity: 0.64;
    }

    @media (max-width: 1060px) {
        .controls {
            grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(140px, 1fr));
        }
    }

    @media (max-width: 980px) {
        .streakCard {
            grid-template-columns: 42px 70px minmax(180px, 1fr) 110px;
        }

        .details {
            grid-column: 3 / -1;
        }
    }

    @media (max-width: 760px) {
        .page {
            padding: 40px 18px 70px;
        }

        h1 {
            font-size: 3rem;
        }

        .summaryBar,
        .controls {
            grid-template-columns: 1fr;
        }

        .streakCard {
            grid-template-columns: 30px 62px 1fr;
            gap: 9px;
            padding: 11px;
        }

        .rank {
            font-size: 0.72rem;
        }

        .playerPhoto {
            width: 58px;
            height: 58px;
        }

        .weeks {
            grid-column: 2;
            grid-row: 2;
            text-align: left;
            align-items: flex-start;
        }

        .weeks strong {
            font-size: 1.5rem;
        }

        .details {
            grid-column: 3;
            grid-row: 2;
            grid-template-columns: 1fr;
        }

        .identity h2 {
            font-size: 1rem;
        }

        .methodology h2 {
            font-size: 1.8rem;
        }
    }

    @media (max-width: 520px) {
        .streakCard {
            grid-template-columns: 26px 54px 1fr;
        }

        .rank {
            font-size: 0.66rem;
        }

        .playerPhoto {
            width: 50px;
            height: 50px;
        }

        .weeks {
            grid-column: 2 / -1;
            grid-row: auto;
            flex-direction: row;
            align-items: baseline;
            gap: 6px;
        }

        .details {
            grid-column: 1 / -1;
            grid-row: auto;
        }

        .listControls {
            flex-direction: column;
        }
    }
</style>
