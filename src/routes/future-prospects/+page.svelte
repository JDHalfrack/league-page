<script>
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';

    export let data;

    let board = {};
    let prospects = [];
    let loadError = '';
    let loading = true;
    let elapsedSeconds = 0;
    let loadedClass = null;
    let activeController = null;
    let elapsedTimer = null;

    let searchText = '';
    let positionFilter = 'all';
    let statusFilter = 'all';

    const currentYear = new Date().getFullYear();
    const defaultProspectClass = currentYear + 1;
    const availableProspectClasses = Array.from(
        { length: Math.max(1, defaultProspectClass - 2019) },
        (_, index) => defaultProspectClass - index
    );

    const CACHE_PREFIX = 'usccffl-future-prospects-v3.0:';

    const normalize = value => String(value || '').toLowerCase().trim();

    $: requestedClass = Number(data?.requestedClass || defaultProspectClass);
    $: prospectClass = Number(board?.prospectClass || requestedClass);
    $: cutoffYear = Number(board?.cutoffYear || prospectClass - 1);
    $: prospects = board?.prospects || [];
    $: loadError = board?.error ? board.message : loadError;

    $: positions = [...new Set(prospects.map(player => player.position))]
        .filter(Boolean)
        .sort();

    $: statuses = [...new Set(prospects.map(player => player.status))]
        .filter(Boolean)
        .sort();

    $: filteredProspects = prospects.filter(player => {
        if (positionFilter !== 'all' && player.position !== positionFilter) return false;
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
    $: eligibleCount = prospects.filter(player =>
        String(player.status || '').includes('Eligible')
    ).length;

    const clearElapsedTimer = () => {
        if (elapsedTimer) {
            clearInterval(elapsedTimer);
            elapsedTimer = null;
        }
    };

    const startElapsedTimer = () => {
        clearElapsedTimer();
        elapsedSeconds = 0;

        elapsedTimer = setInterval(() => {
            elapsedSeconds += 1;
        }, 1000);
    };

    const getSessionBoard = classYear => {
        if (!browser) return null;

        try {
            const raw = sessionStorage.getItem(`${CACHE_PREFIX}${classYear}`);
            if (!raw) return null;

            const cached = JSON.parse(raw);
            if (!cached?.prospects) return null;

            return cached;
        } catch {
            return null;
        }
    };

    const setSessionBoard = (classYear, value) => {
        if (!browser) return;

        try {
            sessionStorage.setItem(
                `${CACHE_PREFIX}${classYear}`,
                JSON.stringify(value)
            );
        } catch {
            // Session cache is optional. Ignore storage failures.
        }
    };

    const loadBoard = async classYear => {
        if (!browser) return;

        activeController?.abort();
        activeController = new AbortController();

        loadError = '';
        loading = true;
        searchText = '';
        positionFilter = 'all';
        statusFilter = 'all';

        const cached = getSessionBoard(classYear);

        if (cached) {
            board = cached;
            loading = false;
            elapsedSeconds = 0;
            clearElapsedTimer();
            return;
        }

        board = {};
        startElapsedTimer();

        try {
            const response = await fetch(
                `/api/future-prospects?class=${classYear}&model=0.3.0`,
                {
                    signal: activeController.signal,
                    headers: {
                        Accept: 'application/json'
                    }
                }
            );

            const result = await response.json();

            if (!response.ok || result?.error) {
                throw new Error(
                    result?.message ||
                    `Future Prospects returned HTTP ${response.status}.`
                );
            }

            board = result;
            setSessionBoard(classYear, result);
        } catch (err) {
            if (err?.name === 'AbortError') return;

            board = {};
            loadError =
                err?.message ||
                'Future Prospects could not load from CollegeFootballData.';
        } finally {
            if (activeController?.signal?.aborted) return;

            loading = false;
            clearElapsedTimer();
        }
    };

    $: if (
        browser &&
        Number.isInteger(requestedClass) &&
        requestedClass !== loadedClass
    ) {
        loadedClass = requestedClass;
        loadBoard(requestedClass);
    }

    const changeProspectClass = event => {
        const selectedClass = Number(event.currentTarget.value);

        goto(`/future-prospects?class=${selectedClass}`, {
            keepFocus: true,
            noScroll: true
        });
    };

    const gradeClass = grade => {
        if (grade >= 95) return 'generational';
        if (grade >= 90) return 'elite';
        if (grade >= 85) return 'first';
        if (grade >= 80) return 'good';
        if (grade >= 75) return 'developmental';
        return 'sleeper';
    };

    const formatGeneratedAt = value => {
        if (!value) return '';

        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(new Date(value));
    };

    const profileLine = player =>
        [
            player.position,
            player.school,
            player.collegeClass,
            player.recruitLabel
        ]
            .filter(Boolean)
            .join(' · ');

    const featuredMetrics = player => [
        ['Production', player.production],
        ['Efficiency', player.efficiency],
        ['Development', player.development],
        ['Size', player.size]
    ];
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
                A living dynasty board for college players who could matter in future USCCFFL rookie drafts.
                Choose a prospect class to recreate what the board should have looked like before that NFL Draft,
                using college data only through the preceding season.
            </p>

            <div class="modelNotice">
                <span class="material-icons">science</span>
                <div>
                    <strong>Model v{board?.modelVersion || '0.1.0'}</strong>
                    <span>
                        Historical snapshots now use only the résumé available at that point in time,
                        with sample-size confidence, college stage, and position-specific size included.
                    </span>
                </div>
            </div>
        </div>

        <div class="rightRail">
            <label class="cutoffCard">
                <span>Prospect class</span>
                <select value={prospectClass} onchange={changeProspectClass}>
                    {#each availableProspectClasses as classYear}
                        <option value={classYear}>{classYear} Prospects</option>
                    {/each}
                </select>

                <small>
                    Uses college stats through the {cutoffYear} season.
                    Players drafted in {cutoffYear} or earlier are excluded.
                </small>
            </label>

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
        </div>
    </section>

    {#if loading}
        <section class="loadingBox" aria-live="polite">
            <div class="loadingTop">
                <div>
                    <div class="eyebrow">CollegeFootballData</div>
                    <h2>Building the {requestedClass} prospect board…</h2>
                </div>
                <strong>{elapsedSeconds}s</strong>
            </div>

            <div
                class="loadingTrack"
                role="progressbar"
                aria-label="Loading prospect board"
                aria-valuetext="Working"
            >
                <div class="loadingBar"></div>
            </div>

            <p>
                Pulling historical college stats and recruiting context, then rebuilding
                each player's résumé as it existed before this draft class.
            </p>

            <small>
                The first uncached load can still take a while. Server-side CFBD reuse,
                CDN caching, and this browser-session cache should make repeat loads much faster.
            </small>
        </section>
    {:else if loadError}
        <section class="errorBox">
            <strong>CollegeFootballData did not load.</strong>
            <span>{loadError}</span>
            <small>Check the Vercel CFBD_API_KEY and the deployment log.</small>
        </section>
    {:else}
        <section class="summaryBar">
            <div><span>Prospects tracked</span><strong>{prospects.length}</strong></div>
            <div><span>90+ grades</span><strong>{eliteCount}</strong></div>
            <div><span>{prospectClass} eligible</span><strong>{eligibleCount}</strong></div>
            <div>
                <span>Prospect class</span>
                <strong>{prospectClass}</strong>
                <small>{board?.generatedAt ? `Built ${formatGeneratedAt(board.generatedAt)}` : ''}</small>
            </div>
        </section>

        {#if featuredProspects.length}
            <section class="section">
                <div class="sectionHeading">
                    <div>
                        <div class="eyebrow">Top of the board</div>
                        <h2>Featured Prospects</h2>
                    </div>
                    <span>{prospectClass} prospect board · stats through {cutoffYear}</span>
                </div>

                <div class="featuredGrid">
                    {#each featuredProspects as player}
                        <article class="featuredCard">
                            <div class="featuredTop">
                                <span class="rank">#{player.rank}</span>
                                <span class="position">{player.position}</span>
                                <span class="status">{player.status}</span>
                            </div>

                            <div class="featuredIdentity">
                                <div class="avatar">{player.position}</div>
                                <div class="featuredText">
                                    <h3>{player.name}</h3>
                                    <p>{profileLine(player)}</p>
                                    {#if player.height || player.weight}
                                        <span class="physical">
                                            {[player.height, player.weight ? `${player.weight} lb` : ''].filter(Boolean).join(' · ')}
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <div class="featuredGrade">
                                <div class="grade {gradeClass(player.grade)}">{player.grade.toFixed(1)}</div>
                                <div><span>Prospect Grade</span><strong>{player.tier}</strong></div>
                            </div>

                            <div class="miniMetrics">
                                {#each featuredMetrics(player) as metric}
                                    <div><span>{metric[0]}</span><strong>{metric[1]}</strong></div>
                                {/each}
                            </div>

                            {#if player.draftOutcome}
                                <div class="outcome">
                                    <span>Actual NFL Draft</span>
                                    <strong>{player.draftOutcome.label}</strong>
                                </div>
                            {/if}
                        </article>
                    {/each}
                </div>
            </section>
        {/if}

        <section class="section">
            <div class="sectionHeading boardHeading">
                <div><div class="eyebrow">Dynasty watchlist</div><h2>Prospect Board</h2></div>
                <span>{filteredProspects.length} showing</span>
            </div>

            <div class="controls">
                <input type="search" bind:value={searchText} placeholder="Search player or school" aria-label="Search prospects" />
                <select bind:value={positionFilter} aria-label="Position">
                    <option value="all">All positions</option>
                    {#each positions as position}<option value={position}>{position}</option>{/each}
                </select>
                <select bind:value={statusFilter} aria-label="Eligibility status">
                    <option value="all">All eligibility</option>
                    {#each statuses as status}<option value={status}>{status}</option>{/each}
                </select>
            </div>

            <div class="board">
                <div class="boardHeader">
                    <span>Rank</span><span>Player</span><span>Grade</span><span>Subgrades</span><span>Outcome / Profile</span>
                </div>

                {#if filteredProspects.length}
                    {#each filteredProspects as player}
                        <article class="prospectRow">
                            <div class="rowRank">#{player.rank}</div>
                            <div class="playerCell">
                                <div class="smallAvatar">{player.position}</div>
                                <div class="playerText">
                                    <h3>{player.name}</h3>
                                    <p>{player.position} · {player.school} · {player.collegeClass} · {player.recruitLabel}</p>
                                    <span class="mobileStatus">{player.status}</span>
                                </div>
                            </div>
                            <div class="gradeCell">
                                <span class="grade compact {gradeClass(player.grade)}">{player.grade.toFixed(1)}</span>
                                <strong>{player.tier}</strong>
                            </div>
                            <div class="subgradeCell">
                                <span>P {player.production}</span>
                                <span>E {player.efficiency}</span>
                                <span>D {player.development}</span>
                                <span>S {player.size}</span>
                            </div>
                            <div class="profileCell">
                                <strong>{player.draftOutcome ? player.draftOutcome.label : player.status}</strong>
                                <span>{[
                                    player.collegeClass,
                                    `${player.observedSeasons || 1} season${player.observedSeasons === 1 ? '' : 's'} of evidence`,
                                    player.height,
                                    player.weight ? `${player.weight} lb` : '',
                                    player.stars ? `${player.stars}★ recruit` : ''
                                ].filter(Boolean).join(' · ')}</span>
                            </div>
                        </article>
                    {/each}
                {:else}
                    <div class="empty">No prospects matched those filters.</div>
                {/if}
            </div>
        </section>

        <section class="methodology">
            <div class="sectionHeading"><div><div class="eyebrow">Model philosophy</div><h2>What Model v{board?.modelVersion || '0.1.0'} measures</h2></div></div>
            <div class="methodGrid">
                <div><span class="methodNumber">01</span><h3>Growing Résumé</h3><p>Only seasons available before the selected prospect class are used. Career production is blended with the latest available season so development and decline move the grade over time.</p></div>
                <div><span class="methodNumber">02</span><h3>Evidence Confidence</h3><p>One-season résumés are pulled toward neutral rather than treated with the same certainty as three or four years of production. This prevents an elite freshman season from automatically becoming a finished NFL profile.</p></div>
                <div><span class="methodNumber">03</span><h3>College Stage</h3><p>Junior receives the strongest stage bump, senior and sophomore are approximately equal, and freshman is lower because freshmen are not yet draft eligible. The adjustment is deliberately modest.</p></div>
                <div><span class="methodNumber">04</span><h3>Size Profile</h3><p>Height and weight contribute a modest position-specific score. The model uses viable NFL ranges rather than simply rewarding bigger players.</p></div>
                <div><span class="methodNumber">05</span><h3>Pedigree & Competition</h3><p>Recruiting pedigree and CFBD team/competition context remain supporting signals; neither can override sustained college production.</p></div>
                <div><span class="methodNumber">06</span><h3>Backtesting</h3><p>The NFL Draft for the selected prospect class is outcome data only. It is never allowed to influence that historical prospect grade.</p></div>
            </div>
            <div class="footerNote">
                <strong>Current model rule:</strong> selecting {prospectClass} Prospects uses college data through the {cutoffYear} season. Players already drafted in {cutoffYear} or earlier are removed. The {prospectClass} NFL Draft can later be shown as a backtesting outcome, but it never influences the grade.
            </div>
        </section>
    {/if}
</div>

<style>
    .page { width:100%; max-width:1180px; margin:0 auto; padding:58px 40px 90px; box-sizing:border-box; font-family:Arial,Helvetica,sans-serif; }
    .hero { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(300px,.72fr); gap:42px; align-items:start; margin-bottom:30px; }
    .heroCopy { max-width:800px; }
    .eyebrow { font-size:.76rem; font-weight:800; letter-spacing:.095em; text-transform:uppercase; opacity:.58; }
    h1 { margin:18px 0 24px; font-size:clamp(3.1rem,7vw,5.2rem); line-height:.94; letter-spacing:-.055em; }
    .lede { max-width:790px; margin:0; font-size:1.08rem; line-height:1.65; }
    .modelNotice { display:flex; align-items:flex-start; gap:12px; max-width:700px; margin-top:23px; padding:13px 15px; border:1px solid rgba(71,120,178,.28); border-radius:9px; background:rgba(71,120,178,.08); }
    .modelNotice .material-icons { margin-top:1px; font-size:1.2rem; }
    .modelNotice div { display:flex; flex-direction:column; gap:3px; }
    .modelNotice span:last-child { font-size:.84rem; line-height:1.4; opacity:.72; }
    .rightRail { display:flex; flex-direction:column; gap:12px; }
    .cutoffCard,.gradeScale { overflow:hidden; border:1px solid rgba(127,127,127,.24); border-radius:12px; background:var(--fff); box-shadow:0 4px 18px rgba(0,0,0,.045); }
    .cutoffCard { display:flex; flex-direction:column; gap:8px; padding:15px 16px; }
    .cutoffCard>span,.scaleTitle { font-size:.7rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
    .cutoffCard>span { opacity:.58; }
    .cutoffCard select { width:100%; min-height:42px; padding:8px 10px; border:1px solid rgba(127,127,127,.3); border-radius:7px; color:inherit; background:var(--fff); font:inherit; font-weight:700; }
    .cutoffCard small { line-height:1.35; opacity:.58; }
    .scaleTitle { padding:14px 16px; border-bottom:1px solid rgba(127,127,127,.16); }
    .scaleRows>div { display:grid; grid-template-columns:62px 1fr; gap:10px; padding:9px 16px; border-bottom:1px solid rgba(127,127,127,.1); font-size:.84rem; }
    .scaleRows>div:last-child { border-bottom:0; }
    .loadingBox {
        margin: 30px 0 44px;
        padding: 22px 24px;
        border: 1px solid rgba(71,120,178,.28);
        border-radius: 12px;
        background: var(--fff);
        box-shadow: 0 4px 18px rgba(0,0,0,.045);
    }

    .loadingTop {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
    }

    .loadingTop h2 {
        margin: 6px 0 0;
        font-size: 1.25rem;
        letter-spacing: -.02em;
    }

    .loadingTop > strong {
        min-width: 42px;
        text-align: right;
        font-size: .88rem;
        opacity: .55;
    }

    .loadingTrack {
        position: relative;
        overflow: hidden;
        height: 9px;
        margin: 18px 0 14px;
        border-radius: 999px;
        background: rgba(127,127,127,.14);
    }

    .loadingBar {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 38%;
        border-radius: inherit;
        background: currentColor;
        opacity: .62;
        animation: prospectLoading 1.35s ease-in-out infinite;
    }

    .loadingBox p {
        margin: 0;
        font-size: .86rem;
        line-height: 1.5;
    }

    .loadingBox small {
        display: block;
        margin-top: 5px;
        line-height: 1.4;
        opacity: .58;
    }

    @keyframes prospectLoading {
        0% { left: -42%; }
        55% { left: 58%; }
        100% { left: 108%; }
    }

    .errorBox { display:flex; flex-direction:column; gap:6px; padding:18px; border:1px solid rgba(175,60,60,.3); border-radius:10px; background:rgba(175,60,60,.08); }
    .errorBox span { line-height:1.5; } .errorBox small { opacity:.65; }
    .summaryBar { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); overflow:hidden; margin:30px 0 44px; border:1px solid rgba(127,127,127,.2); border-radius:10px; background:rgba(127,127,127,.12); gap:1px; }
    .summaryBar>div { display:flex; flex-direction:column; justify-content:center; min-height:78px; padding:14px 17px; background:var(--fff); }
    .summaryBar span { margin-bottom:5px; font-size:.69rem; font-weight:700; letter-spacing:.045em; text-transform:uppercase; opacity:.55; }
    .summaryBar strong { font-size:1.18rem; } .summaryBar small { margin-top:2px; font-size:.7rem; line-height:1.3; opacity:.58; }
    .section { margin-top:46px; }
    .sectionHeading { display:flex; align-items:end; justify-content:space-between; gap:20px; margin-bottom:17px; }
    .sectionHeading h2 { margin:6px 0 0; font-size:1.85rem; letter-spacing:-.025em; }
    .sectionHeading>span { font-size:.78rem; opacity:.55; }
    .featuredGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .featuredCard { min-width:0; padding:17px; border:1px solid rgba(127,127,127,.22); border-radius:12px; background:var(--fff); box-shadow:0 2px 8px rgba(0,0,0,.035); }
    .featuredTop { display:flex; align-items:center; gap:7px; margin-bottom:17px; }
    .rank { font-size:.84rem; font-weight:800; opacity:.55; }
    .position { padding:4px 7px; border-radius:5px; background:rgba(127,127,127,.12); font-size:.69rem; font-weight:800; }
    .status,.mobileStatus { display:inline-block; padding:3px 6px; border-radius:999px; background:rgba(45,110,185,.09); font-size:.64rem; font-weight:700; }
    .featuredTop .status { margin-left:auto; }
    .featuredIdentity { display:flex; align-items:flex-start; gap:11px; min-width:0; }
    .featuredText,.playerText { min-width:0; }
    .avatar,.smallAvatar { display:flex; flex:0 0 auto; align-items:center; justify-content:center; border:1px solid rgba(127,127,127,.22); border-radius:50%; background:rgba(127,127,127,.09); font-weight:800; opacity:.6; }
    .avatar { width:54px; height:54px; font-size:.73rem; }
    .featuredIdentity h3,.playerCell h3 { margin:0; overflow:visible; text-overflow:clip; white-space:normal; line-height:1.18; }
    .featuredIdentity h3 { font-size:1.08rem; }
    .featuredIdentity p { margin:5px 0 3px; font-size:.78rem; line-height:1.35; opacity:.62; }
    .physical { font-size:.7rem; opacity:.55; }
    .featuredGrade { display:flex; align-items:center; gap:11px; margin-top:16px; padding-top:14px; border-top:1px solid rgba(127,127,127,.14); }
    .featuredGrade>div:last-child { display:flex; flex-direction:column; gap:2px; min-width:0; }
    .featuredGrade>div:last-child span { font-size:.66rem; text-transform:uppercase; letter-spacing:.05em; opacity:.5; }
    .featuredGrade>div:last-child strong { font-size:.78rem; line-height:1.25; }
    .grade { display:inline-flex; align-items:center; justify-content:center; min-width:66px; min-height:50px; padding:0 8px; box-sizing:border-box; border-radius:9px; color:#111; background:#ececec; font-size:1.55rem; font-weight:900; letter-spacing:-.04em; }
    .grade.generational { border:1px solid #95d5a6; background:#d7f3df; } .grade.elite { border:1px solid #abd7b5; background:#e2f3e6; } .grade.first { border:1px solid #b6cde6; background:#e8f0f8; } .grade.good { border:1px solid #d4d6a1; background:#f1f2df; } .grade.developmental { border:1px solid #e0c49f; background:#f7ecdd; } .grade.sleeper { border:1px solid #d9b3b3; background:#f1e4e4; }
    .miniMetrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; margin-top:15px; }
    .miniMetrics div { display:flex; flex-direction:column; gap:2px; padding:7px 4px; text-align:center; border-radius:6px; background:rgba(127,127,127,.065); }
    .miniMetrics span { font-size:.52rem; text-transform:uppercase; opacity:.48; } .miniMetrics strong { font-size:.8rem; }
    .outcome { display:flex; flex-direction:column; gap:3px; margin-top:12px; padding:9px 10px; border-radius:7px; background:rgba(127,127,127,.065); }
    .outcome span { font-size:.6rem; text-transform:uppercase; opacity:.5; } .outcome strong { font-size:.75rem; }
    .controls { display:grid; grid-template-columns:minmax(240px,1fr) 155px 190px; gap:8px; margin-bottom:10px; }
    .controls input,.controls select { box-sizing:border-box; width:100%; min-height:42px; padding:8px 10px; border:1px solid rgba(127,127,127,.32); border-radius:8px; color:inherit; background:var(--fff); font:inherit; }
    .board { overflow:hidden; border:1px solid rgba(127,127,127,.2); border-radius:11px; background:var(--fff); }
    .boardHeader,.prospectRow { display:grid; grid-template-columns:58px minmax(235px,1.35fr) minmax(190px,.9fr) 150px minmax(190px,.95fr); gap:12px; align-items:center; }
    .boardHeader { padding:10px 14px; border-bottom:1px solid rgba(127,127,127,.16); background:rgba(127,127,127,.055); font-size:.65rem; font-weight:800; letter-spacing:.055em; text-transform:uppercase; opacity:.58; }
    .prospectRow { min-height:72px; padding:11px 14px; border-bottom:1px solid rgba(127,127,127,.11); }
    .prospectRow:last-child { border-bottom:0; }
    .rowRank { text-align:center; font-size:.82rem; font-weight:800; opacity:.55; }
    .playerCell { display:flex; align-items:flex-start; gap:10px; min-width:0; }
    .smallAvatar { width:44px; height:44px; margin-top:1px; font-size:.63rem; }
    .playerCell h3 { font-size:.94rem; }
    .playerCell p { margin:5px 0 0; font-size:.72rem; line-height:1.35; opacity:.56; overflow:visible; white-space:normal; }
    .mobileStatus { display:none; }
    .gradeCell { display:flex; align-items:center; gap:9px; min-width:0; }
    .grade.compact { min-width:55px; min-height:38px; border-radius:7px; font-size:1rem; }
    .gradeCell>strong { font-size:.73rem; line-height:1.25; }
    .subgradeCell { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px 7px; font-size:.69rem; font-weight:700; opacity:.65; }
    .profileCell { display:flex; flex-direction:column; gap:4px; min-width:0; }
    .profileCell strong { font-size:.72rem; line-height:1.3; } .profileCell span { font-size:.68rem; line-height:1.35; opacity:.6; }
    .empty { padding:35px 18px; text-align:center; opacity:.58; }
    .methodology { margin-top:55px; padding-top:34px; border-top:1px solid rgba(127,127,127,.18); }
    .methodGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:11px; }
    .methodGrid>div { padding:16px; border:1px solid rgba(127,127,127,.18); border-radius:9px; }
    .methodNumber { font-size:.68rem; font-weight:900; opacity:.35; } .methodGrid h3 { margin:8px 0 7px; font-size:.95rem; } .methodGrid p { margin:0; font-size:.78rem; line-height:1.5; opacity:.68; }
    .footerNote { margin-top:14px; padding:15px 17px; border-radius:9px; background:rgba(127,127,127,.07); font-size:.83rem; line-height:1.55; }
    @media(max-width:980px){ .hero{grid-template-columns:1fr;gap:24px}.rightRail{max-width:620px}.summaryBar{grid-template-columns:repeat(2,minmax(0,1fr))}.featuredGrid{grid-template-columns:1fr}.featuredCard{display:grid;grid-template-columns:minmax(220px,1fr) minmax(220px,.85fr);column-gap:20px}.featuredTop{grid-column:1/-1}.featuredGrade{margin:0;padding:0;border:0}.miniMetrics,.outcome{grid-column:1/-1}.boardHeader{display:none}.prospectRow{grid-template-columns:44px minmax(190px,1.4fr) minmax(180px,.8fr) 130px}.profileCell{display:none}.methodGrid{grid-template-columns:repeat(2,minmax(0,1fr))} }
    @media(max-width:700px){ .page{padding:36px 16px 70px}h1{font-size:clamp(3rem,15vw,4.3rem)}.summaryBar{margin-top:24px}.section{margin-top:36px}.sectionHeading{align-items:flex-start;flex-direction:column;gap:5px}.featuredCard{display:block}.featuredGrade{margin-top:16px;padding-top:14px;border-top:1px solid rgba(127,127,127,.14)}.controls{grid-template-columns:1fr}.prospectRow{grid-template-columns:30px 1fr auto;gap:9px;align-items:start;min-height:0}.rowRank{padding-top:12px;font-size:.67rem}.smallAvatar{width:40px;height:40px}.playerCell h3,.playerCell p{white-space:normal}.mobileStatus{display:inline-block;margin-top:5px}.gradeCell{flex-direction:column;align-items:flex-end;gap:4px}.gradeCell>strong{max-width:105px;text-align:right;font-size:.62rem}.subgradeCell{grid-column:2/-1;display:flex;flex-wrap:wrap;gap:5px 12px;padding-left:50px}.methodGrid{grid-template-columns:1fr} }
    @media(max-width:460px){ .summaryBar{grid-template-columns:1fr}.summaryBar>div{min-height:64px}.miniMetrics{grid-template-columns:repeat(2,minmax(0,1fr))}.prospectRow{grid-template-columns:25px 1fr auto;padding:10px 9px}.smallAvatar{display:none}.subgradeCell{padding-left:0} }
</style>
