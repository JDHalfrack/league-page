<script>
    import { onMount } from 'svelte';

    const SEASONS = [
        2019, 2020, 2021, 2022,
        2023, 2024, 2025, 2026
    ];

    const CHUNKS = [
        'core',
        'weeks-1',
        'weeks-2',
        'weeks-3',
        'projections-1',
        'projections-2',
        'projections-3'
    ];

    let adminKey = '';
    let busy = false;
    let currentTask = '';
    let log = [];
    let status = null;
    let statusError = '';

    const addLog = (message, kind = 'info') => {
        log = [
            {
                time: new Date().toLocaleTimeString(),
                message,
                kind
            },
            ...log
        ].slice(0, 200);
    };

    const loadStatus = async () => {
        statusError = '';

        try {
            const response = await fetch(
                '/api/archive-status',
                { cache: 'no-store' }
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    'Archive status request failed.'
                );
            }

            status = data;
        } catch (error) {
            statusError =
                error?.message || String(error);
        }
    };

    const runChunk = async (season, chunk) => {
        currentTask = `${season} / ${chunk}`;

        const response = await fetch(
            '/api/archive-backfill',
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-archive-admin-key': adminKey
                },
                body: JSON.stringify({
                    season,
                    chunk
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data?.ok) {
            throw new Error(
                data?.error ||
                `${season} ${chunk} failed`
            );
        }

        const result = data.result;

        addLog(
            `${season} ${chunk}: ${result.successful}/${result.attempted} successful` +
                (result.failed
                    ? `, ${result.failed} failed`
                    : ''),
            result.failed ? 'warn' : 'success'
        );

        return result;
    };

    const runSeason = async season => {
        if (!adminKey) {
            addLog(
                'Enter ARCHIVE_ADMIN_KEY first.',
                'error'
            );
            return;
        }

        busy = true;

        try {
            for (const chunk of CHUNKS) {
                await runChunk(season, chunk);
            }

            addLog(
                `${season} backfill complete.`,
                'success'
            );
            await loadStatus();
        } catch (error) {
            addLog(
                `${season} stopped: ${
                    error?.message || error
                }`,
                'error'
            );
        } finally {
            currentTask = '';
            busy = false;
        }
    };

    const runEverything = async () => {
        if (!adminKey) {
            addLog(
                'Enter ARCHIVE_ADMIN_KEY first.',
                'error'
            );
            return;
        }

        busy = true;

        try {
            for (const season of SEASONS) {
                for (const chunk of CHUNKS) {
                    await runChunk(season, chunk);
                }

                addLog(
                    `${season} backfill complete.`,
                    'success'
                );
            }

            addLog(
                'All available USCCFFL Sleeper history has been processed.',
                'success'
            );

            await loadStatus();
        } catch (error) {
            addLog(
                `Backfill stopped: ${
                    error?.message || error
                }`,
                'error'
            );
        } finally {
            currentTask = '';
            busy = false;
        }
    };

    onMount(loadStatus);
</script>

<svelte:head>
    <title>USCCFFL Archive Admin</title>
</svelte:head>

<div class="archive-page">
    <section class="hero">
        <div class="eyebrow">USCCFFL DATA ARCHIVE</div>
        <h1>Archive Administration</h1>
        <p>
            Backfill Sleeper history into the permanent
            Postgres archive. This page is intentionally
            not linked in the public navigation.
        </p>
    </section>

    <section class="panel">
        <h2>Database status</h2>

        {#if statusError}
            <div class="error-box">{statusError}</div>
        {:else if !status}
            <p>Loading archive status…</p>
        {:else}
            <div class="status-grid">
                <div class="metric">
                    <span>Database</span>
                    <strong>
                        {status.enabled
                            ? 'CONNECTED'
                            : 'DISABLED'}
                    </strong>
                </div>

                {#each status.providers || [] as provider}
                    <div class="metric">
                        <span>
                            {provider.provider.toUpperCase()}
                        </span>
                        <strong>{provider.entries}</strong>
                        <small>
                            {provider.finalEntries} permanent ·
                            {provider.archiveHits} archive hits
                        </small>
                    </div>
                {/each}
            </div>
        {/if}

        <button
            class="secondary"
            disabled={busy}
            on:click={loadStatus}
        >
            Refresh status
        </button>
    </section>

    <section class="panel">
        <h2>Sleeper historical backfill</h2>

        <label for="archive-key">
            Archive administrator key
        </label>

        <input
            id="archive-key"
            type="password"
            bind:value={adminKey}
            autocomplete="off"
            placeholder="ARCHIVE_ADMIN_KEY"
            disabled={busy}
        />

        <p class="hint">
            The key is checked only by the server. It is not
            stored by this page.
        </p>

        <div class="season-grid">
            {#each SEASONS as season}
                <button
                    disabled={busy || !adminKey}
                    on:click={() => runSeason(season)}
                >
                    Backfill {season}
                </button>
            {/each}
        </div>

        <button
            class="primary"
            disabled={busy || !adminKey}
            on:click={runEverything}
        >
            {busy
                ? `Working: ${currentTask}`
                : 'Backfill Everything'}
        </button>

        {#if busy}
            <p class="working">
                Leave this tab open. The backfill is deliberately
                split into small chunks to avoid Vercel timeouts
                and Sleeper rate-limit spikes.
            </p>
        {/if}
    </section>

    <section class="panel">
        <h2>Activity</h2>

        {#if !log.length}
            <p class="muted">
                No backfill actions in this browser session yet.
            </p>
        {:else}
            <div class="log">
                {#each log as row}
                    <div
                        class:warn={row.kind === 'warn'}
                        class:error={row.kind === 'error'}
                        class:success={row.kind === 'success'}
                    >
                        <span>{row.time}</span>
                        <p>{row.message}</p>
                    </div>
                {/each}
            </div>
        {/if}
    </section>
</div>

<style>
    .archive-page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 18px 72px;
    }

    .hero,
    .panel {
        border: 1px solid rgba(127, 127, 127, 0.28);
        border-radius: 18px;
        padding: 24px;
        margin-bottom: 18px;
        background: rgba(127, 127, 127, 0.05);
    }

    .eyebrow {
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        opacity: 0.68;
    }

    h1,
    h2,
    p {
        margin-top: 0;
    }

    h1 {
        margin-bottom: 8px;
        font-size: clamp(2rem, 5vw, 3.4rem);
    }

    h2 {
        margin-bottom: 18px;
    }

    .status-grid {
        display: grid;
        grid-template-columns:
            repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 18px;
    }

    .metric {
        border: 1px solid rgba(127, 127, 127, 0.25);
        border-radius: 14px;
        padding: 16px;
    }

    .metric span,
    .metric small {
        display: block;
        opacity: 0.68;
    }

    .metric strong {
        display: block;
        margin: 4px 0;
        font-size: 1.45rem;
    }

    label {
        display: block;
        margin-bottom: 7px;
        font-weight: 700;
    }

    input {
        width: min(100%, 520px);
        box-sizing: border-box;
        border: 1px solid rgba(127, 127, 127, 0.4);
        border-radius: 10px;
        padding: 12px 14px;
        font: inherit;
        color: inherit;
        background: transparent;
    }

    .hint,
    .working,
    .muted {
        margin-top: 8px;
        opacity: 0.68;
    }

    .season-grid {
        display: grid;
        grid-template-columns:
            repeat(auto-fit, minmax(125px, 1fr));
        gap: 9px;
        margin: 20px 0 12px;
    }

    button {
        border: 1px solid rgba(127, 127, 127, 0.38);
        border-radius: 10px;
        padding: 11px 14px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
    }

    button:disabled {
        cursor: default;
        opacity: 0.45;
    }

    .primary {
        width: 100%;
        padding: 14px;
    }

    .secondary {
        margin-top: 2px;
    }

    .log {
        max-height: 430px;
        overflow: auto;
    }

    .log > div {
        display: grid;
        grid-template-columns: 90px 1fr;
        gap: 10px;
        padding: 8px 0;
        border-bottom:
            1px solid rgba(127, 127, 127, 0.16);
    }

    .log p {
        margin: 0;
    }

    .log span {
        opacity: 0.6;
    }

    .success p,
    .warn p,
    .error p {
        font-weight: 700;
    }

    .error-box {
        padding: 12px;
        border-radius: 10px;
        border: 1px solid currentColor;
        margin-bottom: 14px;
    }
</style>
