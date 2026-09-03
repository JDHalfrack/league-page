<script>
    /*
        Future Prospects — design shell / preview data.

        This page intentionally uses local preview records so the UI can be reviewed
        before the live college-football data pipeline is connected.
    */

    const prospects = [
        {
            rank: 1,
            name: 'Preview Prospect A',
            position: 'WR',
            school: 'Ohio State',
            classYear: 'Junior',
            grade: 94.2,
            trend: 2.4,
            tier: 'Elite Dynasty Prospect',
            status: '2027 Eligible',
            height: '6′2″',
            weight: '205',
            production: 96,
            efficiency: 92,
            ageProfile: 94,
            pedigree: 97
        },
        {
            rank: 2,
            name: 'Preview Prospect B',
            position: 'RB',
            school: 'Texas',
            classYear: 'Junior',
            grade: 91.8,
            trend: 0.8,
            tier: 'Elite Dynasty Prospect',
            status: '2027 Eligible',
            height: '5′11″',
            weight: '214',
            production: 94,
            efficiency: 91,
            ageProfile: 90,
            pedigree: 91
        },
        {
            rank: 3,
            name: 'Preview Prospect C',
            position: 'QB',
            school: 'Oregon',
            classYear: 'Senior',
            grade: 89.6,
            trend: -0.6,
            tier: 'Strong 1st-Round Prospect',
            status: '2027 Eligible',
            height: '6′3″',
            weight: '218',
            production: 91,
            efficiency: 93,
            ageProfile: 84,
            pedigree: 86
        },
        {
            rank: 4,
            name: 'Preview Prospect D',
            position: 'WR',
            school: 'LSU',
            classYear: 'Sophomore',
            grade: 87.9,
            trend: 4.1,
            tier: 'Strong 1st-Round Prospect',
            status: 'Future Class',
            height: '6′1″',
            weight: '198',
            production: 89,
            efficiency: 88,
            ageProfile: 96,
            pedigree: 94
        },
        {
            rank: 5,
            name: 'Preview Prospect E',
            position: 'TE',
            school: 'Georgia',
            classYear: 'Junior',
            grade: 85.4,
            trend: 1.2,
            tier: 'Strong 1st-Round Prospect',
            status: '2027 Eligible',
            height: '6′5″',
            weight: '248',
            production: 84,
            efficiency: 86,
            ageProfile: 88,
            pedigree: 90
        },
        {
            rank: 6,
            name: 'Preview Prospect F',
            position: 'RB',
            school: 'Notre Dame',
            classYear: 'Senior',
            grade: 82.7,
            trend: -1.4,
            tier: 'Good Prospect',
            status: '2027 Eligible',
            height: '6′0″',
            weight: '220',
            production: 86,
            efficiency: 82,
            ageProfile: 76,
            pedigree: 82
        },
        {
            rank: 7,
            name: 'Preview Prospect G',
            position: 'WR',
            school: 'Alabama',
            classYear: 'Junior',
            grade: 81.5,
            trend: 3.0,
            tier: 'Good Prospect',
            status: '2027 Eligible',
            height: '6′0″',
            weight: '191',
            production: 80,
            efficiency: 84,
            ageProfile: 89,
            pedigree: 93
        },
        {
            rank: 8,
            name: 'Preview Prospect H',
            position: 'QB',
            school: 'Penn State',
            classYear: 'Junior',
            grade: 78.8,
            trend: 0.3,
            tier: 'Developmental',
            status: '2027 Eligible',
            height: '6′4″',
            weight: '225',
            production: 79,
            efficiency: 81,
            ageProfile: 82,
            pedigree: 85
        }
    ];

    let searchText = '';
    let positionFilter = 'all';
    let classFilter = 'all';
    let statusFilter = 'all';

    const normalize = value => String(value || '').toLowerCase().trim();

    $: positions = [...new Set(prospects.map(player => player.position))];
    $: classes = [...new Set(prospects.map(player => player.classYear))];
    $: statuses = [...new Set(prospects.map(player => player.status))];

    $: filteredProspects = prospects.filter(player => {
        if (positionFilter !== 'all' && player.position !== positionFilter) return false;
        if (classFilter !== 'all' && player.classYear !== classFilter) return false;
        if (statusFilter !== 'all' && player.status !== statusFilter) return false;

        const query = normalize(searchText);
        if (!query) return true;

        return (
            normalize(player.name).includes(query) ||
            normalize(player.school).includes(query) ||
            normalize(player.position).includes(query)
        );
    });

    $: featuredProspects = prospects.slice(0, 3);
    $: eliteCount = prospects.filter(player => player.grade >= 90).length;
    $: biggestRiser = [...prospects].sort((a, b) => b.trend - a.trend)[0];

    const gradeClass = grade => {
        if (grade >= 95) return 'generational';
        if (grade >= 90) return 'elite';
        if (grade >= 85) return 'first';
        if (grade >= 80) return 'good';
        if (grade >= 75) return 'developmental';
        return 'sleeper';
    };

    const trendText = trend => {
        if (trend > 0) return `▲ ${trend.toFixed(1)}`;
        if (trend < 0) return `▼ ${Math.abs(trend).toFixed(1)}`;
        return '—';
    };

    const trendClass = trend => {
        if (trend > 0) return 'up';
        if (trend < 0) return 'down';
        return 'flat';
    };
</script>

<svelte:head>
    <title>Future Prospects</title>
</svelte:head>

<div class="page">
    <section class="hero">
        <div class="heroCopy">
            <div class="eyebrow">USCCFFL League Tools</div>
            <h1>Future Prospects</h1>
            <p class="lede">
                A living dynasty board for college players who could matter in future
                USCCFFL rookie drafts. Prospect grades are designed to move as new
                production, efficiency, age, recruiting and draft information becomes available.
            </p>

            <div class="previewNotice">
                <span class="material-icons">construction</span>
                <div>
                    <strong>Design preview</strong>
                    <span>
                        The player records below are placeholder data. The live college-data
                        pipeline is the next build step.
                    </span>
                </div>
            </div>
        </div>

        <div class="gradeScale">
            <div class="scaleTitle">USCCFFL Prospect Grade</div>
            <div class="scaleRows">
                <div><strong>95–99</strong><span>Generational</span></div>
                <div><strong>90–94</strong><span>Elite Dynasty Prospect</span></div>
                <div><strong>85–89</strong><span>Strong 1st-Round Prospect</span></div>
                <div><strong>80–84</strong><span>Good Prospect</span></div>
                <div><strong>75–79</strong><span>Developmental</span></div>
                <div><strong>40–74</strong><span>Sleeper / Long Shot</span></div>
            </div>
        </div>
    </section>

    <section class="summaryBar">
        <div>
            <span>Prospects tracked</span>
            <strong>{prospects.length}</strong>
        </div>
        <div>
            <span>90+ grades</span>
            <strong>{eliteCount}</strong>
        </div>
        <div>
            <span>Biggest riser</span>
            <strong>{biggestRiser?.name}</strong>
            <small>+{biggestRiser?.trend.toFixed(1)} grade points</small>
        </div>
        <div>
            <span>Board status</span>
            <strong>Preview</strong>
        </div>
    </section>

    <section class="section">
        <div class="sectionHeading">
            <div>
                <div class="eyebrow">Top of the board</div>
                <h2>Featured Prospects</h2>
            </div>
            <span class="updated">Future live refresh: weekly + game-day updates</span>
        </div>

        <div class="featuredGrid">
            {#each featuredProspects as player}
                <article class="featuredCard">
                    <div class="featuredTop">
                        <span class="rank">#{player.rank}</span>
                        <span class="position">{player.position}</span>
                        <span class="trend {trendClass(player.trend)}">
                            {trendText(player.trend)}
                        </span>
                    </div>

                    <div class="featuredIdentity">
                        <div class="avatar">{player.position}</div>
                        <div>
                            <h3>{player.name}</h3>
                            <p>{player.school} · {player.classYear}</p>
                            <span class="status">{player.status}</span>
                        </div>
                    </div>

                    <div class="featuredGrade">
                        <div class="grade {gradeClass(player.grade)}">
                            {player.grade.toFixed(1)}
                        </div>
                        <div>
                            <span>Prospect Grade</span>
                            <strong>{player.tier}</strong>
                        </div>
                    </div>

                    <div class="miniMetrics">
                        <div><span>Production</span><strong>{player.production}</strong></div>
                        <div><span>Efficiency</span><strong>{player.efficiency}</strong></div>
                        <div><span>Age</span><strong>{player.ageProfile}</strong></div>
                        <div><span>Pedigree</span><strong>{player.pedigree}</strong></div>
                    </div>
                </article>
            {/each}
        </div>
    </section>

    <section class="section">
        <div class="sectionHeading boardHeading">
            <div>
                <div class="eyebrow">Dynasty watchlist</div>
                <h2>Prospect Board</h2>
            </div>
            <span>{filteredProspects.length} showing</span>
        </div>

        <div class="controls">
            <input
                type="search"
                bind:value={searchText}
                placeholder="Search player or school"
                aria-label="Search prospects"
            />

            <select bind:value={positionFilter} aria-label="Position">
                <option value="all">All positions</option>
                {#each positions as position}
                    <option value={position}>{position}</option>
                {/each}
            </select>

            <select bind:value={classFilter} aria-label="Class">
                <option value="all">All classes</option>
                {#each classes as classYear}
                    <option value={classYear}>{classYear}</option>
                {/each}
            </select>

            <select bind:value={statusFilter} aria-label="Eligibility status">
                <option value="all">All eligibility</option>
                {#each statuses as status}
                    <option value={status}>{status}</option>
                {/each}
            </select>
        </div>

        <div class="board">
            <div class="boardHeader">
                <span>Rank</span>
                <span>Player</span>
                <span>Grade</span>
                <span>Trend</span>
                <span>Profile</span>
            </div>

            {#if filteredProspects.length}
                {#each filteredProspects as player}
                    <article class="prospectRow">
                        <div class="rowRank">#{player.rank}</div>

                        <div class="playerCell">
                            <div class="smallAvatar">{player.position}</div>
                            <div>
                                <h3>{player.name}</h3>
                                <p>
                                    {player.position} · {player.school} · {player.classYear}
                                </p>
                                <span class="mobileStatus">{player.status}</span>
                            </div>
                        </div>

                        <div class="gradeCell">
                            <span class="grade compact {gradeClass(player.grade)}">
                                {player.grade.toFixed(1)}
                            </span>
                            <strong>{player.tier}</strong>
                        </div>

                        <div class="trendCell">
                            <span class="trend {trendClass(player.trend)}">
                                {trendText(player.trend)}
                            </span>
                            <small>since opening board</small>
                        </div>

                        <div class="profileCell">
                            <span>{player.height}</span>
                            <span>{player.weight} lb</span>
                            <span>{player.status}</span>
                        </div>
                    </article>
                {/each}
            {:else}
                <div class="empty">No prospects matched those filters.</div>
            {/if}
        </div>
    </section>

    <section class="methodology">
        <div class="sectionHeading">
            <div>
                <div class="eyebrow">Model philosophy</div>
                <h2>What the grade will measure</h2>
            </div>
        </div>

        <div class="methodGrid">
            <div>
                <span class="methodNumber">01</span>
                <h3>Production</h3>
                <p>
                    Raw college production, market share and age-adjusted breakout
                    performance.
                </p>
            </div>

            <div>
                <span class="methodNumber">02</span>
                <h3>Efficiency</h3>
                <p>
                    Position-specific efficiency rather than simply rewarding volume.
                </p>
            </div>

            <div>
                <span class="methodNumber">03</span>
                <h3>Age & Development</h3>
                <p>
                    Younger players producing against older competition receive more credit.
                </p>
            </div>

            <div>
                <span class="methodNumber">04</span>
                <h3>Recruiting Pedigree</h3>
                <p>
                    Prior prospect status is evidence, but it will never override actual
                    college performance.
                </p>
            </div>

            <div>
                <span class="methodNumber">05</span>
                <h3>Competition</h3>
                <p>
                    Opponent quality and strength of schedule help contextualize the box score.
                </p>
            </div>

            <div>
                <span class="methodNumber">06</span>
                <h3>NFL Evidence</h3>
                <p>
                    Declaration, combine testing and eventual NFL draft capital can be layered
                    into the model as they become known.
                </p>
            </div>
        </div>

        <div class="footerNote">
            <strong>The goal:</strong>
            build a historical USCCFFL prospect model that can eventually be tested against
            actual NFL draft capital and fantasy outcomes, rather than relying on a static
            preseason ranking.
        </div>
    </section>
</div>

<style>
    .page {
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
        padding: 58px 40px 90px;
        box-sizing: border-box;
        font-family: Arial, Helvetica, sans-serif;
    }

    .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(290px, 0.7fr);
        gap: 46px;
        align-items: start;
        margin-bottom: 30px;
    }

    .heroCopy {
        max-width: 790px;
    }

    .eyebrow {
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.095em;
        text-transform: uppercase;
        opacity: 0.58;
    }

    h1 {
        margin: 18px 0 24px;
        font-size: clamp(3.1rem, 7vw, 5.2rem);
        line-height: 0.94;
        letter-spacing: -0.055em;
    }

    .lede {
        max-width: 780px;
        margin: 0;
        font-size: 1.08rem;
        line-height: 1.65;
    }

    .previewNotice {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        max-width: 680px;
        margin-top: 23px;
        padding: 13px 15px;
        border: 1px solid rgba(191, 151, 48, 0.35);
        border-radius: 9px;
        background: rgba(244, 205, 89, 0.12);
    }

    .previewNotice .material-icons {
        font-size: 1.2rem;
        margin-top: 1px;
    }

    .previewNotice div {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .previewNotice span:last-child {
        font-size: 0.84rem;
        line-height: 1.4;
        opacity: 0.72;
    }

    .gradeScale {
        overflow: hidden;
        border: 1px solid rgba(127, 127, 127, 0.24);
        border-radius: 12px;
        background: var(--fff);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.045);
    }

    .scaleTitle {
        padding: 14px 16px;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        border-bottom: 1px solid rgba(127, 127, 127, 0.16);
    }

    .scaleRows > div {
        display: grid;
        grid-template-columns: 62px 1fr;
        gap: 10px;
        padding: 9px 16px;
        border-bottom: 1px solid rgba(127, 127, 127, 0.1);
        font-size: 0.84rem;
    }

    .scaleRows > div:last-child {
        border-bottom: 0;
    }

    .summaryBar {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        overflow: hidden;
        margin: 30px 0 44px;
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 10px;
        background: rgba(127, 127, 127, 0.12);
        gap: 1px;
    }

    .summaryBar > div {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 78px;
        padding: 14px 17px;
        background: var(--fff);
    }

    .summaryBar span {
        margin-bottom: 5px;
        font-size: 0.69rem;
        font-weight: 700;
        letter-spacing: 0.045em;
        text-transform: uppercase;
        opacity: 0.55;
    }

    .summaryBar strong {
        font-size: 1.18rem;
    }

    .summaryBar small {
        margin-top: 2px;
        font-size: 0.73rem;
        opacity: 0.58;
    }

    .section {
        margin-top: 46px;
    }

    .sectionHeading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 17px;
    }

    .sectionHeading h2 {
        margin: 6px 0 0;
        font-size: 1.85rem;
        letter-spacing: -0.025em;
    }

    .sectionHeading > span,
    .updated {
        font-size: 0.78rem;
        opacity: 0.55;
    }

    .featuredGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
    }

    .featuredCard {
        padding: 17px;
        border: 1px solid rgba(127, 127, 127, 0.22);
        border-radius: 12px;
        background: var(--fff);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.035);
    }

    .featuredTop {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 17px;
    }

    .rank {
        font-size: 0.84rem;
        font-weight: 800;
        opacity: 0.55;
    }

    .position {
        padding: 4px 7px;
        border-radius: 5px;
        background: rgba(127, 127, 127, 0.12);
        font-size: 0.69rem;
        font-weight: 800;
    }

    .featuredTop .trend {
        margin-left: auto;
    }

    .featuredIdentity {
        display: flex;
        align-items: center;
        gap: 11px;
        min-width: 0;
    }

    .avatar,
    .smallAvatar {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(127, 127, 127, 0.22);
        border-radius: 50%;
        background: rgba(127, 127, 127, 0.09);
        font-weight: 800;
        opacity: 0.6;
    }

    .avatar {
        width: 54px;
        height: 54px;
        font-size: 0.73rem;
    }

    .featuredIdentity h3,
    .playerCell h3 {
        margin: 0;
    }

    .featuredIdentity h3 {
        font-size: 1.08rem;
    }

    .featuredIdentity p {
        margin: 3px 0 5px;
        font-size: 0.78rem;
        opacity: 0.62;
    }

    .status,
    .mobileStatus {
        display: inline-block;
        padding: 3px 6px;
        border-radius: 999px;
        background: rgba(45, 110, 185, 0.09);
        font-size: 0.64rem;
        font-weight: 700;
    }

    .featuredGrade {
        display: flex;
        align-items: center;
        gap: 11px;
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid rgba(127, 127, 127, 0.14);
    }

    .featuredGrade > div:last-child {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .featuredGrade > div:last-child span {
        font-size: 0.66rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.5;
    }

    .featuredGrade > div:last-child strong {
        font-size: 0.78rem;
        line-height: 1.25;
    }

    .grade {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 66px;
        min-height: 50px;
        padding: 0 8px;
        box-sizing: border-box;
        border-radius: 9px;
        font-size: 1.55rem;
        font-weight: 900;
        letter-spacing: -0.04em;
        color: #111;
        background: #ececec;
    }

    .grade.generational {
        background: #d7f3df;
        border: 1px solid #95d5a6;
    }

    .grade.elite {
        background: #e2f3e6;
        border: 1px solid #abd7b5;
    }

    .grade.first {
        background: #e8f0f8;
        border: 1px solid #b6cde6;
    }

    .grade.good {
        background: #f1f2df;
        border: 1px solid #d4d6a1;
    }

    .grade.developmental {
        background: #f7ecdd;
        border: 1px solid #e0c49f;
    }

    .grade.sleeper {
        background: #f1e4e4;
        border: 1px solid #d9b3b3;
    }

    .miniMetrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        margin-top: 15px;
    }

    .miniMetrics div {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 7px 5px;
        text-align: center;
        border-radius: 6px;
        background: rgba(127, 127, 127, 0.065);
    }

    .miniMetrics span {
        font-size: 0.56rem;
        text-transform: uppercase;
        opacity: 0.48;
    }

    .miniMetrics strong {
        font-size: 0.8rem;
    }

    .trend {
        font-size: 0.76rem;
        font-weight: 800;
        white-space: nowrap;
    }

    .trend.up {
        color: #258347;
    }

    .trend.down {
        color: #aa4545;
    }

    .trend.flat {
        opacity: 0.5;
    }

    .controls {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) 145px 150px 175px;
        gap: 8px;
        margin-bottom: 10px;
    }

    .controls input,
    .controls select {
        box-sizing: border-box;
        width: 100%;
        min-height: 42px;
        padding: 8px 10px;
        border: 1px solid rgba(127, 127, 127, 0.32);
        border-radius: 8px;
        color: inherit;
        background: var(--fff);
        font: inherit;
    }

    .board {
        overflow: hidden;
        border: 1px solid rgba(127, 127, 127, 0.2);
        border-radius: 11px;
        background: var(--fff);
    }

    .boardHeader,
    .prospectRow {
        display: grid;
        grid-template-columns: 58px minmax(230px, 1.4fr) minmax(200px, 1fr) 130px minmax(185px, 0.9fr);
        gap: 12px;
        align-items: center;
    }

    .boardHeader {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(127, 127, 127, 0.16);
        background: rgba(127, 127, 127, 0.055);
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.055em;
        text-transform: uppercase;
        opacity: 0.58;
    }

    .prospectRow {
        padding: 11px 14px;
        border-bottom: 1px solid rgba(127, 127, 127, 0.11);
    }

    .prospectRow:last-child {
        border-bottom: 0;
    }

    .rowRank {
        text-align: center;
        font-size: 0.82rem;
        font-weight: 800;
        opacity: 0.55;
    }

    .playerCell {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }

    .smallAvatar {
        width: 44px;
        height: 44px;
        font-size: 0.63rem;
    }

    .playerCell h3 {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.94rem;
    }

    .playerCell p {
        margin: 3px 0 0;
        font-size: 0.72rem;
        opacity: 0.56;
    }

    .mobileStatus {
        display: none;
    }

    .gradeCell {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
    }

    .grade.compact {
        min-width: 55px;
        min-height: 38px;
        border-radius: 7px;
        font-size: 1rem;
    }

    .gradeCell > strong {
        font-size: 0.73rem;
        line-height: 1.25;
    }

    .trendCell,
    .profileCell {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .trendCell small {
        font-size: 0.62rem;
        opacity: 0.5;
    }

    .profileCell {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 4px 10px;
        font-size: 0.7rem;
        opacity: 0.68;
    }

    .empty {
        padding: 35px 18px;
        text-align: center;
        opacity: 0.58;
    }

    .methodology {
        margin-top: 55px;
        padding-top: 34px;
        border-top: 1px solid rgba(127, 127, 127, 0.18);
    }

    .methodGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 11px;
    }

    .methodGrid > div {
        padding: 16px;
        border: 1px solid rgba(127, 127, 127, 0.18);
        border-radius: 9px;
    }

    .methodNumber {
        font-size: 0.68rem;
        font-weight: 900;
        opacity: 0.35;
    }

    .methodGrid h3 {
        margin: 8px 0 7px;
        font-size: 0.95rem;
    }

    .methodGrid p {
        margin: 0;
        font-size: 0.78rem;
        line-height: 1.5;
        opacity: 0.68;
    }

    .footerNote {
        margin-top: 14px;
        padding: 15px 17px;
        border-radius: 9px;
        background: rgba(127, 127, 127, 0.07);
        font-size: 0.83rem;
        line-height: 1.55;
    }

    @media (max-width: 980px) {
        .hero {
            grid-template-columns: 1fr;
            gap: 24px;
        }

        .gradeScale {
            max-width: 620px;
        }

        .summaryBar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .featuredGrid {
            grid-template-columns: 1fr;
        }

        .featuredCard {
            display: grid;
            grid-template-columns: minmax(220px, 1fr) minmax(220px, 0.85fr);
            column-gap: 20px;
        }

        .featuredTop {
            grid-column: 1 / -1;
        }

        .featuredGrade {
            margin: 0;
            padding: 0;
            border: 0;
        }

        .miniMetrics {
            grid-column: 1 / -1;
        }

        .controls {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .boardHeader {
            display: none;
        }

        .prospectRow {
            grid-template-columns: 44px minmax(180px, 1.5fr) minmax(180px, 0.9fr) 110px;
        }

        .profileCell {
            display: none;
        }

        .methodGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    @media (max-width: 700px) {
        .page {
            padding: 36px 16px 70px;
        }

        h1 {
            font-size: clamp(3rem, 15vw, 4.3rem);
        }

        .summaryBar {
            margin-top: 24px;
        }

        .section {
            margin-top: 36px;
        }

        .sectionHeading {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
        }

        .featuredCard {
            display: block;
        }

        .featuredGrade {
            margin-top: 16px;
            padding-top: 14px;
            border-top: 1px solid rgba(127, 127, 127, 0.14);
        }

        .controls {
            grid-template-columns: 1fr;
        }

        .prospectRow {
            grid-template-columns: 30px 1fr auto;
            gap: 9px;
            align-items: start;
        }

        .rowRank {
            padding-top: 12px;
            font-size: 0.67rem;
        }

        .playerCell {
            align-items: flex-start;
        }

        .smallAvatar {
            width: 40px;
            height: 40px;
        }

        .playerCell h3 {
            white-space: normal;
        }

        .mobileStatus {
            display: inline-block;
            margin-top: 5px;
        }

        .gradeCell {
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
        }

        .gradeCell > strong {
            max-width: 105px;
            text-align: right;
            font-size: 0.62rem;
        }

        .trendCell {
            grid-column: 2 / -1;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 7px;
            padding-left: 50px;
        }

        .methodGrid {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 460px) {
        .summaryBar {
            grid-template-columns: 1fr;
        }

        .summaryBar > div {
            min-height: 64px;
        }

        .miniMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .prospectRow {
            grid-template-columns: 25px 1fr auto;
            padding: 10px 9px;
        }

        .smallAvatar {
            display: none;
        }

        .trendCell {
            padding-left: 0;
        }
    }
</style>
