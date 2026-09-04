import {
    sleeperGet,
    sleeperHistoricalGet
} from '$lib/server/sleeperArchive';

export const LEAGUE_ARCHIVE = [
    { season: 2019, leagueId: '407807711988695040' },
    { season: 2020, leagueId: '517432431025664000' },
    { season: 2021, leagueId: '650120255582101504' },
    { season: 2022, leagueId: '784485837789319168' },
    { season: 2023, leagueId: '917281268096901120' },
    { season: 2024, leagueId: '1050136982275383296' },
    { season: 2025, leagueId: '1180214242271457280' },
    { season: 2026, leagueId: '1312126115816415232' }
];

const CURRENT_TTL_MS = 15 * 60 * 1000;
const PROJECTION_TTL_MS = 60 * 60 * 1000;
const CURRENT_YEAR = () => new Date().getUTCFullYear();

const runWithConcurrency = async (jobs, limit = 4) => {
    const results = new Array(jobs.length);
    let next = 0;

    const worker = async () => {
        while (true) {
            const index = next++;
            if (index >= jobs.length) return;

            try {
                results[index] = {
                    ok: true,
                    value: await jobs[index]()
                };
            } catch (error) {
                results[index] = {
                    ok: false,
                    error: error?.message || String(error)
                };
            }
        }
    };

    await Promise.all(
        Array.from(
            { length: Math.min(limit, jobs.length) },
            () => worker()
        )
    );

    return results;
};

const findLeague = season => {
    const normalized = Number(season);
    const found = LEAGUE_ARCHIVE.find(
        row => row.season === normalized
    );

    if (!found) {
        throw new Error(
            `Unsupported season ${season}.`
        );
    }

    return found;
};

const isHistoricalSeason = season =>
    Number(season) < CURRENT_YEAR();

const archiveRequest = async (
    pathOrUrl,
    {
        season,
        type,
        week = null,
        extra = {},
        notFoundValue
    }
) => {
    const historical = isHistoricalSeason(season);
    const metadata = {
        source: 'usccffl-backfill-v0.2',
        season,
        type,
        ...(week === null ? {} : { week }),
        ...extra
    };

    if (historical) {
        return sleeperHistoricalGet(
            pathOrUrl,
            metadata,
            { notFoundValue }
        );
    }

    return sleeperGet(pathOrUrl, {
        ttlMs:
            type === 'projection'
                ? PROJECTION_TTL_MS
                : CURRENT_TTL_MS,
        isFinal: false,
        metadata,
        notFoundValue
    });
};

const getCurrentNflState = async () =>
    sleeperGet('/state/nfl', {
        ttlMs: CURRENT_TTL_MS,
        metadata: {
            source: 'usccffl-backfill-v0.2',
            type: 'nfl-state'
        }
    });

const maximumWeekForSeason = async season => {
    if (isHistoricalSeason(season)) return 18;

    const state = await getCurrentNflState().catch(() => null);
    if (!state) return 1;

    if (Number(state.season) > Number(season)) return 18;
    if (Number(state.season) < Number(season)) return 0;

    const seasonType = String(state.season_type || '').toLowerCase();

    if (seasonType === 'pre') {
        return 1;
    }

    return Math.max(
        1,
        Math.min(18, Number(state.week) || 1)
    );
};

const summarize = (season, chunk, results, extra = {}) => {
    const successful = results.filter(row => row?.ok).length;
    const failed = results.length - successful;

    return {
        season,
        chunk,
        attempted: results.length,
        successful,
        failed,
        errors: results
            .filter(row => !row?.ok)
            .map(row => row.error)
            .slice(0, 20),
        ...extra
    };
};

const backfillCore = async info => {
    const { season, leagueId } = info;
    const base = `/league/${leagueId}`;

    const namedJobs = [
        ['league', () =>
            archiveRequest(base, { season, type: 'league' })
        ],
        ['users', () =>
            archiveRequest(`${base}/users`, { season, type: 'users' })
        ],
        ['rosters', () =>
            archiveRequest(`${base}/rosters`, { season, type: 'rosters' })
        ],
        ['traded-picks', () =>
            archiveRequest(`${base}/traded_picks`, {
                season,
                type: 'traded-picks',
                notFoundValue: []
            })
        ],
        ['winners-bracket', () =>
            archiveRequest(`${base}/winners_bracket`, {
                season,
                type: 'winners-bracket',
                notFoundValue: []
            })
        ],
        ['losers-bracket', () =>
            archiveRequest(`${base}/losers_bracket`, {
                season,
                type: 'losers-bracket',
                notFoundValue: []
            })
        ],
        ['drafts', () =>
            archiveRequest(`${base}/drafts`, {
                season,
                type: 'drafts',
                notFoundValue: []
            })
        ]
    ];

    const coreResults = await runWithConcurrency(
        namedJobs.map(([, job]) => job),
        4
    );

    let drafts = [];
    const draftIndex = namedJobs.findIndex(
        ([name]) => name === 'drafts'
    );

    if (coreResults[draftIndex]?.ok) {
        drafts = Array.isArray(coreResults[draftIndex].value)
            ? coreResults[draftIndex].value
            : [];
    }

    const draftJobs = drafts
        .filter(draft => draft?.draft_id)
        .map(draft => async () => {
            const draftId = String(draft.draft_id);
            const completed =
                String(draft.status || '').toLowerCase() === 'complete';

            if (isHistoricalSeason(season) || completed) {
                return sleeperHistoricalGet(
                    `/draft/${draftId}/picks`,
                    {
                        source: 'usccffl-backfill-v0.2',
                        season,
                        type: 'draft-picks',
                        draftId
                    },
                    { notFoundValue: [] }
                );
            }

            return sleeperGet(
                `/draft/${draftId}/picks`,
                {
                    ttlMs: CURRENT_TTL_MS,
                    metadata: {
                        source: 'usccffl-backfill-v0.2',
                        season,
                        type: 'draft-picks',
                        draftId
                    },
                    notFoundValue: []
                }
            );
        });

    const draftResults = await runWithConcurrency(
        draftJobs,
        3
    );

    return summarize(
        season,
        'core',
        [...coreResults, ...draftResults],
        {
            draftsFound: drafts.length
        }
    );
};

const chunkWeeks = chunk => {
    const match = /^weeks-(\d+)$/.exec(chunk);
    if (!match) return null;

    const part = Number(match[1]);
    if (part < 1 || part > 3) return null;

    const start = (part - 1) * 6 + 1;
    return Array.from({ length: 6 }, (_, i) => start + i);
};

const projectionWeeks = chunk => {
    const match = /^projections-(\d+)$/.exec(chunk);
    if (!match) return null;

    const part = Number(match[1]);
    if (part < 1 || part > 3) return null;

    const start = (part - 1) * 6 + 1;
    return Array.from({ length: 6 }, (_, i) => start + i);
};

const backfillWeeks = async (info, chunk) => {
    const { season, leagueId } = info;
    const requestedWeeks = chunkWeeks(chunk);
    const maxWeek = await maximumWeekForSeason(season);
    const weeks = requestedWeeks.filter(
        week => week <= maxWeek
    );

    const jobs = [];

    for (const week of weeks) {
        jobs.push(() =>
            archiveRequest(
                `/league/${leagueId}/matchups/${week}`,
                {
                    season,
                    week,
                    type: 'matchups',
                    notFoundValue: []
                }
            )
        );

        jobs.push(() =>
            archiveRequest(
                `/league/${leagueId}/transactions/${week}`,
                {
                    season,
                    week,
                    type: 'transactions',
                    notFoundValue: []
                }
            )
        );
    }

    const results = await runWithConcurrency(jobs, 4);

    return summarize(
        season,
        chunk,
        results,
        {
            weeks,
            skippedFutureWeeks:
                requestedWeeks.length - weeks.length,
            maximumEligibleWeek: maxWeek
        }
    );
};

const loadProjectionWeek = async (season, week) => {
    const regularUrl =
        `https://api.sleeper.app/projections/nfl/${season}/${week}` +
        '?season_type=regular';

    const regular = await archiveRequest(
        regularUrl,
        {
            season,
            week,
            type: 'projection',
            extra: { seasonType: 'regular' },
            notFoundValue: []
        }
    );

    if (Array.isArray(regular) && regular.length) {
        return {
            season,
            week,
            seasonType: 'regular',
            rows: regular.length
        };
    }

    const postUrl =
        `https://api.sleeper.app/projections/nfl/${season}/${week}` +
        '?season_type=post';

    const post = await archiveRequest(
        postUrl,
        {
            season,
            week,
            type: 'projection',
            extra: { seasonType: 'post' },
            notFoundValue: []
        }
    );

    return {
        season,
        week,
        seasonType:
            Array.isArray(post) && post.length
                ? 'post'
                : 'none',
        rows: Array.isArray(post) ? post.length : 0
    };
};

const backfillProjections = async (info, chunk) => {
    const { season } = info;
    const requestedWeeks = projectionWeeks(chunk);
    const maxWeek = await maximumWeekForSeason(season);
    const weeks = requestedWeeks.filter(
        week => week <= maxWeek
    );

    const results = await runWithConcurrency(
        weeks.map(
            week => () =>
                loadProjectionWeek(season, week)
        ),
        3
    );

    return summarize(
        season,
        chunk,
        results,
        {
            weeks,
            skippedFutureWeeks:
                requestedWeeks.length - weeks.length,
            maximumEligibleWeek: maxWeek,
            projectionRows: results
                .filter(row => row?.ok)
                .reduce(
                    (sum, row) =>
                        sum +
                        Number(row.value?.rows || 0),
                    0
                )
        }
    );
};

export const BACKFILL_CHUNKS = [
    'core',
    'weeks-1',
    'weeks-2',
    'weeks-3',
    'projections-1',
    'projections-2',
    'projections-3'
];

export const runSleeperBackfillChunk = async ({
    season,
    chunk
}) => {
    const info = findLeague(season);

    if (!BACKFILL_CHUNKS.includes(chunk)) {
        throw new Error(
            `Unknown backfill chunk "${chunk}".`
        );
    }

    if (chunk === 'core') {
        return backfillCore(info);
    }

    if (chunk.startsWith('weeks-')) {
        return backfillWeeks(info, chunk);
    }

    return backfillProjections(info, chunk);
};
