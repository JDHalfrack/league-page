import { leagueID } from '$lib/utils/leagueInfo';
import { getLeagueData } from './leagueData';
import { getLeagueTeamManagers } from './leagueTeamManagers';

const MIN_TRANSACTION_ROUND = 0;
const MAX_TRANSACTION_ROUND = 18;

let cachedTracker = null;
let pendingTracker = null;

export const getKeeperTracker = async (playerCatalog = {}, refresh = false) => {
    if (cachedTracker && !refresh) return cachedTracker;
    if (pendingTracker && !refresh) return pendingTracker;

    pendingTracker = buildKeeperTracker(playerCatalog);

    try {
        cachedTracker = await pendingTracker;
        return cachedTracker;
    } finally {
        pendingTracker = null;
    }
};

const buildKeeperTracker = async playerCatalog => {
    const [teamManagers, seasons, nflState] = await Promise.all([
        getLeagueTeamManagers(),
        getHistoricalLeagueChain(),
        getCurrentNflState()
    ]);

    const seasonPackages = await mapWithConcurrency(
        seasons,
        2,
        season => loadSeasonPackage(season, nflState)
    );

    const activeStints = new Map();
    const completedStints = [];
    let globalWeekIndex = 0;

    const currentSeason = Math.max(...seasons.map(season => Number(season.year)));

    for (const seasonPackage of seasonPackages) {
        const year = Number(seasonPackage.year);
        const teamMap = teamManagers?.teamManagersMap?.[year] || {};
        const eventBuckets = buildEventBuckets(seasonPackage);

        processEvents(
            eventBuckets.preWeek,
            activeStints,
            completedStints,
            teamMap,
            playerCatalog
        );

        for (let week = 1; week <= seasonPackage.lastLoadedWeek; week++) {
            processEvents(
                eventBuckets.byWeek.get(week) || [],
                activeStints,
                completedStints,
                teamMap,
                playerCatalog
            );

            globalWeekIndex++;

            reconcileWeeklySnapshot({
                year,
                week,
                globalWeekIndex,
                rosterSnapshots: seasonPackage.rostersByWeek.get(week) || new Map(),
                activeStints,
                completedStints,
                teamMap,
                playerCatalog
            });
        }

        processEvents(
            eventBuckets.postWeek,
            activeStints,
            completedStints,
            teamMap,
            playerCatalog
        );
    }

    const currentRosters = await loadCurrentRosters(leagueID);
    const latestTeamMap = teamManagers?.teamManagersMap?.[currentSeason] || {};

    // Current rosters determine which unfinished streaks are still active.
    // This preserves offseason continuity without adding fake calendar weeks.
    for (const [rosterID, playerSet] of currentRosters.entries()) {
        for (const playerID of playerSet) {
            const key = ownershipKey(rosterID, playerID);

            if (!activeStints.has(key)) {
                activeStints.set(
                    key,
                    createStint({
                        playerID,
                        rosterID,
                        year: currentSeason,
                        week: 0,
                        acquisition: null,
                        teamMap: latestTeamMap,
                        playerCatalog
                    })
                );
            }

            const stint = activeStints.get(key);
            stint.teamName = getTeamName(latestTeamMap, rosterID, stint.teamName);
            stint.active = true;
        }
    }

    for (const [key, stint] of [...activeStints.entries()]) {
        const currentPlayers = currentRosters.get(Number(stint.rosterID));

        if (currentPlayers && currentPlayers.has(String(stint.playerID))) {
            continue;
        }

        finishStint(stint, completedStints, {
            reason: 'Roster break',
            season: currentSeason,
            week: null,
            timestamp: null
        });

        activeStints.delete(key);
    }

    const activeResults = [...activeStints.values()].map(stint => ({
        ...stint,
        active: true,
        endReason: null,
        endDate: null,
        endSeason: null,
        endWeek: null
    }));

    const streaks = [...completedStints, ...activeResults]
        .filter(stint => Number(stint.weeks) > 0)
        .sort(compareStreaks)
        .map((stint, index) => ({
            ...stint,
            rank: index + 1
        }));

    return {
        generatedAt: Date.now(),
        currentSeason,
        nflState,
        seasons: seasonPackages.map(season => ({
            year: season.year,
            leagueID: season.leagueID,
            playoffStart: season.playoffStart,
            playoffRounds: season.playoffRounds,
            finalLeagueWeek: season.finalLeagueWeek,
            loadedThroughWeek: season.lastLoadedWeek,
            matchupRows: season.matchupRows.length,
            transactions: season.transactions.length,
            drafts: season.drafts.length
        })),
        streaks,
        summary: {
            totalStreaks: streaks.length,
            activeStreaks: streaks.filter(streak => streak.active).length,
            longestWeeks: streaks[0]?.weeks || 0
        }
    };
};

const getHistoricalLeagueChain = async () => {
    const seasons = [];
    let currentLeagueID = leagueID;
    const visited = new Set();

    while (
        currentLeagueID &&
        currentLeagueID != 0 &&
        !visited.has(String(currentLeagueID))
    ) {
        visited.add(String(currentLeagueID));

        const leagueData = await getLeagueData(currentLeagueID);
        if (!leagueData) break;

        const playoffStart = Number(leagueData?.settings?.playoff_week_start) || null;
        const playoffRounds = await getPlayoffRoundCount(String(currentLeagueID));
        const finalLeagueWeek =
            playoffStart && playoffRounds
                ? playoffStart + playoffRounds - 1
                : null;

        seasons.push({
            leagueID: String(currentLeagueID),
            year: Number(leagueData.season),
            playoffStart,
            playoffRounds,
            finalLeagueWeek
        });

        currentLeagueID = leagueData.previous_league_id;
    }

    return seasons.sort((a, b) => a.year - b.year);
};

const getPlayoffRoundCount = async targetLeagueID => {
    try {
        const response = await fetch(
            `https://api.sleeper.app/v1/league/${targetLeagueID}/winners_bracket`,
            { compress: true }
        );

        if (!response.ok) return null;

        const bracket = await response.json();
        if (!Array.isArray(bracket) || !bracket.length) return null;

        const rounds = bracket
            .map(matchup => Number(matchup?.r))
            .filter(Number.isFinite);

        return rounds.length ? Math.max(...rounds) : null;
    } catch {
        return null;
    }
};

const getCurrentNflState = async () => {
    try {
        const response = await fetch('https://api.sleeper.app/v1/state/nfl', {
            compress: true
        });

        if (!response.ok) return null;

        const raw = await response.json();
        const season = Number(raw?.season);
        const week = Number(raw?.week);
        const seasonType = String(raw?.season_type || '').toLowerCase();
        let lastCompletedWeek = null;

        if (seasonType === 'pre' || seasonType === 'preseason') {
            lastCompletedWeek = 0;
        } else if (seasonType === 'regular') {
            lastCompletedWeek = Number.isFinite(week) ? Math.max(0, week - 1) : null;
        } else if (seasonType === 'post' || seasonType === 'postseason') {
            lastCompletedWeek = 18;
        }

        return {
            season: Number.isFinite(season) ? season : null,
            week: Number.isFinite(week) ? week : null,
            seasonType: seasonType || null,
            lastCompletedWeek
        };
    } catch {
        return null;
    }
};

const loadSeasonPackage = async (season, nflState) => {
    const [transactions, drafts, matchupPackage] = await Promise.all([
        loadSeasonTransactions(season),
        loadSeasonDrafts(season),
        loadSeasonMatchups(season, nflState)
    ]);

    return {
        ...season,
        transactions,
        drafts,
        matchupRows: matchupPackage.rows,
        rostersByWeek: matchupPackage.rostersByWeek,
        lastLoadedWeek: matchupPackage.lastLoadedWeek
    };
};

const loadSeasonTransactions = async season => {
    const requests = [];

    for (let round = MIN_TRANSACTION_ROUND; round <= MAX_TRANSACTION_ROUND; round++) {
        requests.push(
            fetch(
                `https://api.sleeper.app/v1/league/${season.leagueID}/transactions/${round}`,
                { compress: true }
            )
                .then(async response => ({
                    round,
                    ok: response.ok,
                    data: response.ok ? await response.json() : []
                }))
                .catch(() => ({
                    round,
                    ok: false,
                    data: []
                }))
        );
    }

    const results = await Promise.all(requests);
    const map = new Map();

    for (const result of results) {
        if (!result.ok || !Array.isArray(result.data)) continue;

        for (const transaction of result.data) {
            const normalized = {
                ...transaction,
                _sourceSeason: Number(season.year),
                _sourceRound: Number(result.round)
            };

            const key = String(
                transaction?.transaction_id ||
                `${season.leagueID}|${result.round}|${transaction?.status_updated}|${transaction?.type}`
            );

            if (!map.has(key)) map.set(key, normalized);
        }
    }

    return [...map.values()]
        .filter(transaction => transaction.status !== 'failed')
        .sort(compareTransactionsAscending);
};

const loadSeasonDrafts = async season => {
    try {
        const response = await fetch(
            `https://api.sleeper.app/v1/league/${season.leagueID}/drafts`,
            { compress: true }
        );

        if (!response.ok) return [];

        const draftList = await response.json();
        if (!Array.isArray(draftList)) return [];

        const completed = draftList.filter(draft => draft.status === 'complete');

        const packages = await Promise.all(
            completed.map(async draftInfo => {
                const draftID = draftInfo.draft_id;

                try {
                    const [infoResponse, picksResponse] = await Promise.all([
                        fetch(`https://api.sleeper.app/v1/draft/${draftID}`, { compress: true }),
                        fetch(`https://api.sleeper.app/v1/draft/${draftID}/picks`, { compress: true })
                    ]);

                    if (!infoResponse.ok || !picksResponse.ok) return null;

                    const [info, picks] = await Promise.all([
                        infoResponse.json(),
                        picksResponse.json()
                    ]);

                    return {
                        draftID,
                        season: Number(info.season || draftInfo.season || season.year),
                        startTime: normalizeTimestamp(info.start_time || draftInfo.start_time),
                        picks: Array.isArray(picks) ? picks : []
                    };
                } catch {
                    return null;
                }
            })
        );

        return packages.filter(Boolean);
    } catch {
        return [];
    }
};

const loadSeasonMatchups = async (season, nflState) => {
    const configuredLastWeek =
        Number.isFinite(Number(season.finalLeagueWeek)) && Number(season.finalLeagueWeek) > 0
            ? Number(season.finalLeagueWeek)
            : 18;

    const isCurrentSeason =
        Number.isFinite(Number(nflState?.season)) &&
        Number(season.year) === Number(nflState.season);

    const currentCompletedWeek =
        isCurrentSeason && Number.isFinite(Number(nflState?.lastCompletedWeek))
            ? Math.max(0, Number(nflState.lastCompletedWeek))
            : null;

    const lastWeek =
        currentCompletedWeek === null
            ? configuredLastWeek
            : Math.min(configuredLastWeek, currentCompletedWeek);

    if (lastWeek <= 0) {
        return {
            rows: [],
            rostersByWeek: new Map(),
            lastLoadedWeek: 0
        };
    }

    const weeks = Array.from({ length: lastWeek }, (_, index) => index + 1);

    const results = await mapWithConcurrency(weeks, 6, async week => {
        try {
            const response = await fetch(
                `https://api.sleeper.app/v1/league/${season.leagueID}/matchups/${week}`,
                { compress: true }
            );

            if (!response.ok) return { week, rows: [] };

            const rows = await response.json();
            return { week, rows: Array.isArray(rows) ? rows : [] };
        } catch {
            return { week, rows: [] };
        }
    });

    const rows = [];
    const rostersByWeek = new Map();

    for (const result of results) {
        const rosterMap = new Map();

        for (const row of result.rows) {
            const rosterID = Number(row.roster_id);
            if (!Number.isFinite(rosterID)) continue;

            const players = new Set(
                (Array.isArray(row.players) ? row.players : []).map(String)
            );

            rosterMap.set(rosterID, players);
            rows.push({
                ...row,
                _season: Number(season.year),
                _week: Number(result.week)
            });
        }

        rostersByWeek.set(Number(result.week), rosterMap);
    }

    return {
        rows,
        rostersByWeek,
        lastLoadedWeek: lastWeek
    };
};

const buildEventBuckets = seasonPackage => {
    const preWeek = [];
    const postWeek = [];
    const byWeek = new Map();

    const pushEvent = event => {
        const week = Number(event.week);

        if (!Number.isFinite(week) || week <= 0) {
            preWeek.push(event);
            return;
        }

        if (week > seasonPackage.lastLoadedWeek) {
            postWeek.push(event);
            return;
        }

        if (!byWeek.has(week)) byWeek.set(week, []);
        byWeek.get(week).push(event);
    };

    for (const draft of seasonPackage.drafts) {
        for (const pick of draft.picks) {
            const playerID = pick.player_id ? String(pick.player_id) : null;
            const rosterID = Number(pick.roster_id);
            const draftRound = Number(pick.round);
            const isKeeper = pick.is_keeper === true;

            if (
                !playerID ||
                !Number.isFinite(rosterID)
            ) {
                continue;
            }

            /*
                Sleeper explicitly marks retained players with
                is_keeper === true. Keeper rows confirm that the
                player remained with the franchise, but they are
                NOT a fresh acquisition and therefore must not
                reset an existing continuous ownership streak.

                Any non-keeper draft pick is a true draft
                acquisition regardless of its numerical round.
            */
            if (isKeeper) {
                continue;
            }

            pushEvent({
                kind: 'acquire',
                method: 'Drafted',
                playerID,
                rosterID,
                season: Number(seasonPackage.year),
                week: 0,
                timestamp: draft.startTime,
                source: 'draft',
                draftRound: Number.isFinite(draftRound) ? draftRound : null
            });
        }
    }

    for (const transaction of seasonPackage.transactions) {
        const week = Number(transaction._sourceRound) || 0;
        const timestamp = normalizeTimestamp(
            transaction.status_updated || transaction.created
        );
        const type = String(transaction.type || '').toLowerCase();
        const drops = transaction.drops || {};
        const adds = transaction.adds || {};

        for (const [rawPlayerID, rawRosterID] of Object.entries(drops)) {
            const rosterID = Number(rawRosterID);
            if (!Number.isFinite(rosterID)) continue;

            pushEvent({
                kind: 'release',
                reason: type === 'trade' ? 'Traded' : 'Dropped',
                playerID: String(rawPlayerID),
                rosterID,
                season: Number(seasonPackage.year),
                week,
                timestamp,
                source: type || 'transaction'
            });
        }

        for (const [rawPlayerID, rawRosterID] of Object.entries(adds)) {
            const rosterID = Number(rawRosterID);
            if (!Number.isFinite(rosterID)) continue;

            pushEvent({
                kind: 'acquire',
                method: type === 'trade' ? 'Acquired via Trade' : 'Signed',
                playerID: String(rawPlayerID),
                rosterID,
                season: Number(seasonPackage.year),
                week,
                timestamp,
                source: type || 'transaction'
            });
        }
    }

    const sortEvents = events =>
        events.sort((a, b) => {
            const timestampDifference = Number(a.timestamp || 0) - Number(b.timestamp || 0);
            if (timestampDifference !== 0) return timestampDifference;

            if (a.kind !== b.kind) return a.kind === 'release' ? -1 : 1;
            return 0;
        });

    sortEvents(preWeek);
    sortEvents(postWeek);
    for (const events of byWeek.values()) sortEvents(events);

    return { preWeek, postWeek, byWeek };
};

const processEvents = (
    events,
    activeStints,
    completedStints,
    teamMap,
    playerCatalog
) => {
    for (const event of events) {
        const key = ownershipKey(event.rosterID, event.playerID);
        const current = activeStints.get(key);

        if (event.kind === 'release') {
            if (current) {
                finishStint(current, completedStints, {
                    reason: event.reason,
                    season: event.season,
                    week: event.week,
                    timestamp: event.timestamp
                });
                activeStints.delete(key);
            }
            continue;
        }

        if (event.kind === 'acquire') {
            // Any fresh acquisition starts a fresh streak, even by the same franchise.
            if (current) {
                finishStint(current, completedStints, {
                    reason: event.method === 'Drafted' ? 'Re-drafted' : 'Reacquired',
                    season: event.season,
                    week: event.week,
                    timestamp: event.timestamp
                });
                activeStints.delete(key);
            }

            activeStints.set(
                key,
                createStint({
                    playerID: event.playerID,
                    rosterID: event.rosterID,
                    year: event.season,
                    week: event.week,
                    acquisition: event,
                    teamMap,
                    playerCatalog
                })
            );
        }
    }
};

const reconcileWeeklySnapshot = ({
    year,
    week,
    globalWeekIndex,
    rosterSnapshots,
    activeStints,
    completedStints,
    teamMap,
    playerCatalog
}) => {
    const presentKeys = new Set();

    for (const [rosterID, playerSet] of rosterSnapshots.entries()) {
        for (const playerID of playerSet) {
            const key = ownershipKey(rosterID, playerID);
            presentKeys.add(key);

            if (!activeStints.has(key)) {
                activeStints.set(
                    key,
                    createStint({
                        playerID,
                        rosterID,
                        year,
                        week,
                        acquisition: null,
                        teamMap,
                        playerCatalog
                    })
                );
            }

            const stint = activeStints.get(key);
            stint.weeks++;
            stint.lastSeason = year;
            stint.lastWeek = week;
            stint.lastGlobalWeekIndex = globalWeekIndex;
            stint.teamName = getTeamName(teamMap, rosterID, stint.teamName);
        }
    }

    for (const [key, stint] of [...activeStints.entries()]) {
        if (stint.lastGlobalWeekIndex === globalWeekIndex || presentKeys.has(key)) {
            continue;
        }

        if (stint.weeks === 0 && Number(stint.startSeason) === Number(year)) {
            continue;
        }

        finishStint(stint, completedStints, {
            reason: 'Roster break',
            season: year,
            week,
            timestamp: null
        });

        activeStints.delete(key);
    }
};

const createStint = ({
    playerID,
    rosterID,
    year,
    week,
    acquisition,
    teamMap,
    playerCatalog
}) => {
    const player = playerCatalog?.[String(playerID)] || {};
    const displayName =
        [player.fn, player.ln].filter(Boolean).join(' ') || `Player ${playerID}`;

    return {
        playerID: String(playerID),
        playerName: displayName,
        position: player.pos || null,
        nflTeam: player.t || null,
        photoUrl: `https://sleepercdn.com/content/nfl/players/${String(playerID)}.jpg`,
        rosterID: Number(rosterID),
        teamName: getTeamName(teamMap, rosterID, `Roster ${rosterID}`),
        weeks: 0,
        startSeason: Number(year),
        startWeek: Number(week) || 0,
        acquisitionMethod: acquisition?.method || 'Acquisition unknown',
        acquisitionDate: acquisition?.timestamp || null,
        acquisitionSeason: Number(acquisition?.season || year),
        acquisitionWeek: Number(acquisition?.week ?? week) || 0,
        lastSeason: null,
        lastWeek: null,
        lastGlobalWeekIndex: null,
        active: false,
        endReason: null,
        endDate: null,
        endSeason: null,
        endWeek: null
    };
};

const finishStint = (stint, completedStints, ending) => {
    if (Number(stint.weeks) <= 0) return;

    completedStints.push({
        ...stint,
        active: false,
        endReason: ending?.reason || 'Roster break',
        endDate: ending?.timestamp || null,
        endSeason: ending?.season ?? stint.lastSeason,
        endWeek: ending?.week ?? stint.lastWeek
    });
};

const loadCurrentRosters = async targetLeagueID => {
    const result = new Map();

    try {
        const response = await fetch(
            `https://api.sleeper.app/v1/league/${targetLeagueID}/rosters`,
            { compress: true }
        );

        if (!response.ok) return result;

        const rosters = await response.json();
        if (!Array.isArray(rosters)) return result;

        for (const roster of rosters) {
            const rosterID = Number(roster.roster_id);
            if (!Number.isFinite(rosterID)) continue;

            result.set(
                rosterID,
                new Set((Array.isArray(roster.players) ? roster.players : []).map(String))
            );
        }
    } catch {
        return result;
    }

    return result;
};

const getTeamName = (teamMap, rosterID, fallback) =>
    teamMap?.[Number(rosterID)]?.team?.name || fallback || `Roster ${rosterID}`;

const ownershipKey = (rosterID, playerID) =>
    `${Number(rosterID)}|${String(playerID)}`;

const compareTransactionsAscending = (a, b) => {
    const aTime = normalizeTimestamp(a?.status_updated || a?.created) || 0;
    const bTime = normalizeTimestamp(b?.status_updated || b?.created) || 0;

    if (aTime !== bTime) return aTime - bTime;

    return Number(a?._sourceRound || 0) - Number(b?._sourceRound || 0);
};

const normalizeTimestamp = value => {
    if (value === null || value === undefined || value === '') return null;

    let timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return null;

    if (timestamp > 0 && timestamp < 100000000000) timestamp *= 1000;
    return timestamp;
};

const compareStreaks = (a, b) => {
    const weekDifference = Number(b.weeks) - Number(a.weeks);
    if (weekDifference !== 0) return weekDifference;

    if (Boolean(a.active) !== Boolean(b.active)) return a.active ? -1 : 1;

    const seasonDifference = Number(a.startSeason) - Number(b.startSeason);
    if (seasonDifference !== 0) return seasonDifference;

    return String(a.playerName).localeCompare(String(b.playerName));
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
    if (!Array.isArray(items) || !items.length) return [];

    const results = new Array(items.length);
    let nextIndex = 0;

    const workers = Array.from(
        {
            length: Math.min(Math.max(1, concurrency), items.length)
        },
        async () => {
            while (true) {
                const index = nextIndex++;
                if (index >= items.length) break;
                results[index] = await mapper(items[index], index);
            }
        }
    );

    await Promise.all(workers);
    return results;
};
