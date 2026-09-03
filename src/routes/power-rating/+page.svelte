<script>
  import { browser } from '$app/environment';

  let loading = true;
  let loadError = '';
  let data = null;
  let selectedOwnerId = 'all';
  let elapsedSeconds = 0;
  let timer = null;

  const CACHE_KEY = 'usccffl-owner-power-rating-v1';

  const loadRatings = async () => {
    if (!browser) return;
    loading = true;
    loadError = '';

    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        data = JSON.parse(cached);
        loading = false;
        return;
      }
    } catch {}

    elapsedSeconds = 0;
    timer = setInterval(() => elapsedSeconds += 1, 1000);

    try {
      const response = await fetch('/api/power-rating');
      const result = await response.json();
      if (!response.ok || result?.error) throw new Error(result?.message || `HTTP ${response.status}`);
      data = result;
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch {}
    } catch (err) {
      loadError = err?.message || 'The Power Rating could not be loaded.';
    } finally {
      loading = false;
      if (timer) clearInterval(timer);
      timer = null;
    }
  };

  $: owners = data?.owners || [];
  $: selectedOwner = selectedOwnerId === 'all' ? null : owners.find(o => o.ownerId === selectedOwnerId) || null;
  $: chartOwners = selectedOwner ? [selectedOwner] : owners.filter(o => o.games > 0).slice(0, 12);
  $: notableGames = selectedOwner
    ? [...selectedOwner.gameLog].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8)
    : data?.biggestUpsets?.slice(0, 8) || [];

  $: chart = (() => {
    const all = chartOwners.flatMap(o => o.history || []);
    if (!all.length) return { width: 1000, height: 420, min: 1400, max: 1600, paths: [], labels: [] };

    const width = 1000, height = 420;
    const pad = { left: 58, right: 20, top: 24, bottom: 42 };
    const keys = [];
    const seen = new Set();
    for (const o of chartOwners) for (const p of o.history || []) {
      const key = `${p.season}-${p.week}`;
      if (!seen.has(key)) { seen.add(key); keys.push({ key, season: p.season, week: p.week }); }
    }
    keys.sort((a, b) => a.season - b.season || a.week - b.week);
    const index = new Map(keys.map((p, i) => [p.key, i]));
    const ratings = all.map(p => p.rating);
    const min = Math.floor((Math.min(1500, ...ratings) - 25) / 50) * 50;
    const max = Math.ceil((Math.max(1500, ...ratings) + 25) / 50) * 50;
    const x = i => pad.left + (i / Math.max(1, keys.length - 1)) * (width - pad.left - pad.right);
    const y = rating => pad.top + ((max - rating) / Math.max(1, max - min)) * (height - pad.top - pad.bottom);
    const paths = chartOwners.map((o, i) => ({
      ownerId: o.ownerId, name: o.name, seriesIndex: i,
      points: (o.history || []).map(p => `${x(index.get(`${p.season}-${p.week}`))},${y(p.rating)}`).join(' ')
    }));
    const labels = [...new Set(keys.map(k => k.season))].map(season => {
      const ix = keys.findIndex(k => k.season === season);
      return { season, x: x(ix) };
    });
    return { width, height, min, max, pad, paths, labels };
  })();

  const signed = v => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}`;
  const record = o => `${o.wins}-${o.losses}${o.ties ? `-${o.ties}` : ''}`;

  if (browser) loadRatings();
</script>

<svelte:head><title>Owner Power Rating</title></svelte:head>

<div class="page">
  <section class="hero">
    <div class="eyebrow">USCCFFL League Tools</div>
    <h1>Owner Power Rating</h1>
    <p class="lede">A living, owner-based measure of league strength from 2019 to the present. Team names can change. Franchises can change. The rating follows the owner.</p>
    <div class="model"><span class="material-icons">insights</span><div><strong>Modified Elo v{data?.modelVersion || '1.0.0'}</strong><span>Wins matter most. Upsets, margin, projected margin and performance versus projection determine how much each result moves the rating.</span></div></div>
  </section>

  {#if loading}
    <section class="loadingCard"><div class="spinner"></div><h2>Rebuilding USCCFFL history…</h2><p>Processing archived owner matchups and available Sleeper projections. {elapsedSeconds ? `${elapsedSeconds}s` : ''}</p></section>
  {:else if loadError}
    <section class="errorCard"><h2>Power Rating unavailable</h2><p>{loadError}</p><button onclick={loadRatings}>Try again</button></section>
  {:else if data}
    <section class="summaryStrip">
      <div><span>Games processed</span><strong>{data.coverage.games}</strong></div>
      <div><span>Projection coverage</span><strong>{data.coverage.projectionCoveragePct}%</strong></div>
      <div><span>Starting rating</span><strong>{data.baseRating}</strong></div>
      <div><span>Current #1</span><strong>{owners[0]?.name || '—'}</strong></div>
    </section>

    <section class="section">
      <div class="sectionHeading"><div><div class="eyebrow">Current table</div><h2>Owner Rankings</h2></div>
        <select bind:value={selectedOwnerId}><option value="all">All owners</option>{#each owners as owner}<option value={owner.ownerId}>{owner.name}</option>{/each}</select>
      </div>
      <div class="rankings">
        {#each owners as owner}
          <button class:selected={selectedOwnerId === owner.ownerId} class="rankingRow" onclick={() => selectedOwnerId = selectedOwnerId === owner.ownerId ? 'all' : owner.ownerId}>
            <span class="rank">{owner.rank}</span>
            <div class="ownerMain"><strong>{owner.name}</strong><span>{record(owner)} · {owner.winPct}%</span></div>
            <div class="rating"><strong>{owner.rating.toFixed(1)}</strong><span>Power Rating</span></div>
            <div class="mini"><span>Peak {owner.peak.toFixed(1)}</span><span>{owner.weeksAtOne} wk at #1</span></div>
          </button>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="sectionHeading"><div><div class="eyebrow">2019–present</div><h2>{selectedOwner ? `${selectedOwner.name} Rating History` : 'League Power History'}</h2></div></div>
      <div class="chartWrap">
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Owner power rating history">
          {#each Array(5) as _, i}
            {@const rating = chart.min + ((chart.max - chart.min) * i) / 4}
            {@const y = chart.pad?.top + ((chart.max - rating) / Math.max(1, chart.max - chart.min)) * (chart.height - chart.pad?.top - chart.pad?.bottom)}
            <line x1={chart.pad?.left} x2={chart.width - chart.pad?.right} y1={y} y2={y} class="gridLine" />
            <text x={chart.pad?.left - 10} y={y + 4} text-anchor="end" class="axisText">{Math.round(rating)}</text>
          {/each}
          {#each chart.labels as label}<text x={label.x} y={chart.height - 12} class="axisText">{label.season}</text>{/each}
          {#each chart.paths as path}<polyline points={path.points} class={`series s${path.seriesIndex % 12}`}><title>{path.name}</title></polyline>{/each}
        </svg>
      </div>
      <div class="legend">{#each chart.paths as path}<button onclick={() => selectedOwnerId = path.ownerId}><span class={`dot b${path.seriesIndex % 12}`}></span>{path.name}</button>{/each}</div>
    </section>

    {#if selectedOwner}
      <section class="ownerCards"><div><span>Current</span><strong>{selectedOwner.rating.toFixed(1)}</strong></div><div><span>All-time peak</span><strong>{selectedOwner.peak.toFixed(1)}</strong></div><div><span>All-time low</span><strong>{selectedOwner.low.toFixed(1)}</strong></div><div><span>Weeks at #1</span><strong>{selectedOwner.weeksAtOne}</strong></div></section>
    {/if}

    <section class="section">
      <div class="sectionHeading"><div><div class="eyebrow">{selectedOwner ? 'Largest swings' : 'Against the odds'}</div><h2>{selectedOwner ? `${selectedOwner.name}'s Most Impactful Games` : 'Biggest Upsets'}</h2></div></div>
      <div class="games">
        {#each notableGames as game}
          {#if selectedOwner}
            <div class="gameRow"><div class={`result ${game.result}`}>{game.result}</div><div><strong>{game.season} Week {game.week} vs. {game.opponent}</strong><span>{game.pointsFor.toFixed(2)}–{game.pointsAgainst.toFixed(2)} · expected win {game.expectedWinPct}%</span></div><strong class:positive={game.change > 0} class:negative={game.change < 0}>{signed(game.change)}</strong></div>
          {:else}
            <div class="gameRow"><div class="bolt material-icons">bolt</div><div><strong>{game.winnerName} over {game.loserName}</strong><span>{game.season} Week {game.week} · winner entered at {game.winnerExpectedPct}% expected</span></div><strong class="positive">{signed(game.winnerChange)}</strong></div>
          {/if}
        {/each}
      </div>
    </section>

    <section class="section methodology">
      <div class="eyebrow">How it works</div><h2>USCCFFL Power Rating Method</h2>
      <div class="methodGrid">
        <div><span>01</span><h3>Owner, not franchise</h3><p>Every owner begins at 1500 when first appearing. The rating follows Sleeper user ID across team-name and franchise changes.</p></div>
        <div><span>02</span><h3>Expected result</h3><p>Historical Elo supplies 65% of expected win probability. When archived projections are available, lineup projections supply the other 35%.</p></div>
        <div><span>03</span><h3>Upsets matter</h3><p>Beating an owner you were expected to lose to produces a much larger move than handling a heavy favorite's business.</p></div>
        <div><span>04</span><h3>Margin has context</h3><p>Actual margin is compared with projected margin. Losing by five when you were expected to lose by fifty hurts far less.</p></div>
        <div><span>05</span><h3>Projection performance</h3><p>Your own score versus projection slightly modifies the result. It matters, but cannot overwhelm the win or loss.</p></div>
        <div><span>06</span><h3>Zero-sum and bounded</h3><p>Every gain is the opponent's equal loss. Margin effects diminish, and no single matchup can move an owner more than 32 points.</p></div>
      </div>
      {#if data.coverage.projectionCoveragePct < 100}<div class="coverage"><span class="material-icons">info</span><p>Archived projection data was usable for {data.coverage.projectionCoveragePct}% of processed games. Games without it use owner Elo expectation only; they are not discarded.</p></div>{/if}
    </section>
  {/if}
</div>

<style>
  .page{width:min(1180px,calc(100% - 32px));margin:auto;padding:34px 0 70px;color:var(--g111)}
  .hero{padding:42px;border-radius:24px;background:radial-gradient(circle at 90% 10%,rgba(55,114,255,.18),transparent 30%),linear-gradient(135deg,rgba(0,49,107,.1),rgba(255,255,255,.02));border:1px solid rgba(0,49,107,.22);margin-bottom:24px}
  .eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:.72rem;font-weight:800;color:#3977c9}
  h1{font-size:clamp(2.4rem,5vw,4.6rem);margin:8px 0 12px;line-height:.98} h2{margin:4px 0 0;font-size:clamp(1.5rem,3vw,2.25rem)}
  .lede{max-width:820px;font-size:1.08rem;line-height:1.7;color:var(--g555)}
  .model{margin-top:26px;display:flex;gap:14px;padding:16px 18px;border-radius:14px;background:rgba(0,49,107,.08)} .model strong,.model span{display:block}.model span{margin-top:3px;color:var(--g555)}
  .summaryStrip,.ownerCards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}.summaryStrip>div,.ownerCards>div{padding:18px;border:1px solid rgba(0,49,107,.18);border-radius:14px;background:var(--fff)}.summaryStrip span,.ownerCards span{display:block;color:var(--g555);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em}.summaryStrip strong,.ownerCards strong{display:block;margin-top:5px;font-size:1.55rem}
  .section{margin-top:28px;padding:26px;border-radius:18px;border:1px solid rgba(0,49,107,.18);background:var(--fff)}.sectionHeading{display:flex;gap:16px;justify-content:space-between;align-items:end;margin-bottom:20px}select{min-width:180px;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,49,107,.25);background:var(--fff);color:var(--g111)}
  .rankings{display:grid;gap:8px}.rankingRow{width:100%;display:grid;grid-template-columns:46px minmax(180px,1fr) 140px 170px;gap:14px;align-items:center;text-align:left;padding:13px 14px;border-radius:12px;border:1px solid transparent;background:rgba(0,49,107,.035);color:inherit;cursor:pointer}.rankingRow:hover,.rankingRow.selected{border-color:rgba(0,49,107,.28);background:rgba(0,49,107,.08)}.rank{font-size:1.3rem;font-weight:900;text-align:center}.ownerMain strong,.ownerMain span,.rating strong,.rating span,.mini span{display:block}.ownerMain span,.rating span,.mini{color:var(--g555);font-size:.82rem}.rating strong{font-size:1.3rem}
  .chartWrap{overflow-x:auto}svg{width:100%;min-width:760px;height:auto}.gridLine{stroke:rgba(127,127,127,.22);stroke-width:1}.axisText{fill:currentColor;opacity:.65;font-size:12px}.series{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;opacity:.8}.series:hover{stroke-width:5;opacity:1}.s0{stroke:#2563eb}.s1{stroke:#dc2626}.s2{stroke:#16a34a}.s3{stroke:#9333ea}.s4{stroke:#ea580c}.s5{stroke:#0891b2}.s6{stroke:#c026d3}.s7{stroke:#65a30d}.s8{stroke:#4f46e5}.s9{stroke:#e11d48}.s10{stroke:#0f766e}.s11{stroke:#a16207}.b0{background:#2563eb}.b1{background:#dc2626}.b2{background:#16a34a}.b3{background:#9333ea}.b4{background:#ea580c}.b5{background:#0891b2}.b6{background:#c026d3}.b7{background:#65a30d}.b8{background:#4f46e5}.b9{background:#e11d48}.b10{background:#0f766e}.b11{background:#a16207}.legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.legend button{border:1px solid rgba(0,49,107,.16);background:transparent;color:inherit;border-radius:999px;padding:6px 10px;display:flex;gap:7px;align-items:center;cursor:pointer}.dot{width:9px;height:9px;border-radius:50%}
  .games{display:grid;gap:9px}.gameRow{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:12px;padding:13px;border-radius:12px;background:rgba(0,49,107,.04)}.gameRow div>strong,.gameRow div>span{display:block}.gameRow div>span{margin-top:3px;color:var(--g555);font-size:.84rem}.result,.bolt{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;font-weight:900}.W{background:rgba(22,163,74,.13);color:#16a34a}.L{background:rgba(220,38,38,.12);color:#dc2626}.T{background:rgba(127,127,127,.12)}.bolt{background:rgba(234,88,12,.12);color:#ea580c}.positive{color:#16a34a}.negative{color:#dc2626}
  .methodGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-top:22px}.methodGrid>div{padding:18px;border-radius:14px;background:rgba(0,49,107,.045)}.methodGrid>div>span{font-size:.75rem;font-weight:900;color:#3977c9}.methodGrid h3{margin:7px 0}.methodGrid p{margin:0;line-height:1.55;color:var(--g555);font-size:.9rem}.coverage{display:flex;gap:12px;padding:16px;margin-top:16px;border-radius:12px;background:rgba(234,88,12,.08)}.coverage p{margin:0;line-height:1.55}
  .loadingCard,.errorCard{min-height:280px;border:1px solid rgba(0,49,107,.18);border-radius:18px;display:grid;place-items:center;align-content:center;text-align:center;padding:30px;background:var(--fff)}.spinner{width:44px;height:44px;border-radius:50%;border:4px solid rgba(0,49,107,.15);border-top-color:#3977c9;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
  @media(max-width:760px){.page{width:min(100% - 20px,1180px);padding-top:18px}.hero{padding:24px 20px}.summaryStrip,.ownerCards{grid-template-columns:repeat(2,1fr)}.section{padding:18px 14px}.sectionHeading{align-items:stretch;flex-direction:column}.rankingRow{grid-template-columns:34px 1fr 100px}.mini{display:none}.methodGrid{grid-template-columns:1fr}.gameRow{grid-template-columns:36px 1fr auto}}
</style>
