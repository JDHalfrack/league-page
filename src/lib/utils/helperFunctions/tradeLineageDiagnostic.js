import { leagueID } from '$lib/utils/leagueInfo';
import { getLeagueData } from './leagueData';
import { getLeagueTeamManagers } from './leagueTeamManagers';


/*
    =====================================================
    HISTORICAL TRADE ANALYZER - PHASE 5
    =====================================================

    Phase 5 keeps the complete lineage and positional
    normalization from Phase 4, then scores each ELIGIBLE
    trade side against every other eligible trade side in
    league history.

    PLAYER LEVEL
    - Raw rostered points
    - Same-position 0-100 Position Score
    - Additive Positional Value Units

    TRADE-SIDE LEVEL
    - Sum every descendant player's Positional Value Units
    - Rank that complete return against all other eligible
      historical trade sides
    - Convert the historical rank to a 0-100
      WHAT WE KNOW NOW score

    COMPARATIVE RESULT
    - EVEN: score gap <= 5
    - SLIGHT EDGE: score gap > 5 and <= 15
    - CLEAR WIN: score gap > 15 and <= 30
    - LANDSLIDE: score gap > 30

    Scores remain independent rather than zero-sum.

    CURRENT-SEASON RULE
    - Future Sleeper matchup placeholders do NOT count.
    - The current season is capped at the last completed
      NFL/fantasy week.
    - Before Week 1 is completed, current-season production
      contributes zero rostered weeks and zero points.

    PLAYER RULES
    - A player received in a trade is followed forward
      while that franchise owns him.
    - If the franchise officially drops him, that branch
      ends.
    - If the franchise trades him, the branch continues
      into the assets that franchise received in that
      later trade.
    - If no later disposition exists and the player is
      still on the current roster, the branch is marked
      STILL HELD.
    - If no disposition is found but the player is not
      currently rostered, the branch is marked
      NO DISPOSITION FOUND rather than inventing a drop.

    PICK RULES
    - A pick is identified by:
          season + round + ORIGINAL roster
    - If the pick is traded again, the branch continues
      into the assets received for it.
    - If it is used, it converts into the player selected.
    - The selected player then follows the normal player
      rules.

    BUNDLED TRADE RULE
    - If two lineage assets are later sent together in the
      same trade, the received return is followed ONCE.
    - The second asset points to the already-followed
      continuation. This prevents double-counting.

    ELIGIBILITY
    - Only trades at least two full years old are intended
      for eventual "What We Know Now" grading.
    =====================================================
*/


const MIN_TRANSACTION_ROUND =
    0;


const MAX_TRANSACTION_ROUND =
    18;


const MIN_TRADE_AGE_YEARS =
    2;


const MAX_LINEAGE_DEPTH =
    40;


const EVEN_MAX_GAP =
    5;


const SLIGHT_EDGE_MAX_GAP =
    15;


const CLEAR_WIN_MAX_GAP =
    30;


let cachedDiagnostics =
    null;


let pendingDiagnostics =
    null;


/*
    =====================================================
    PUBLIC
    =====================================================
*/

export const getTradeLineageDiagnostics =
    async (
        playerCatalog = {},
        refresh = false
    ) => {

        if (
            cachedDiagnostics &&
            !refresh
        ) {
            return cachedDiagnostics;
        }


        if (
            pendingDiagnostics &&
            !refresh
        ) {
            return pendingDiagnostics;
        }


        pendingDiagnostics =
            buildDiagnostics(
                playerCatalog
            );


        try {
            cachedDiagnostics =
                await pendingDiagnostics;


            return cachedDiagnostics;
        }
        finally {
            pendingDiagnostics =
                null;
        }
    };


/*
    =====================================================
    BUILD
    =====================================================
*/

const buildDiagnostics =
    async (
        playerCatalog = {}
    ) => {

        const teamManagers =
            await getLeagueTeamManagers();


        const seasons =
            await getHistoricalLeagueChain();


        const nflState =
            await getCurrentNflState();


        const seasonPackages =
            await mapWithConcurrency(
                seasons,
                2,
                season =>
                    loadSeasonPackage(
                        season,
                        nflState
                    )
            );


        const allTransactions =
            dedupeTransactions(
                seasonPackages.flatMap(
                    item =>
                        item.transactions
                )
            )
                .filter(
                    transaction =>
                        transaction.status !==
                        'failed'
                )
                .sort(
                    compareTransactionsAscending
                );


        const rawTrades =
            allTransactions.filter(
                transaction =>
                    transaction.type ===
                    'trade'
            );


        const drafts =
            seasonPackages.flatMap(
                item =>
                    item.drafts
            );


        const draftPickLookup =
            buildDraftPickLookup(
                drafts
            );


        const productionLookup =
            buildProductionLookup(
                seasonPackages
            );


        const latestSeason =
            seasons.length
                ? seasons[
                    seasons.length -
                    1
                ]
                : null;


        const currentRosterPlayers =
            latestSeason
                ? await loadCurrentRosterPlayers(
                    latestSeason.leagueID
                )
                : {};


        const lineageContext = {
            transactions:
                allTransactions,

            draftPickLookup,

            currentRosterPlayers,

            productionLookup,

            playerCatalog
        };


        const trades =
            rawTrades.map(
                transaction =>
                    digestTrade({
                        transaction,

                        teamManagers,

                        draftPickLookup,

                        lineageContext
                    })
            );


        const eligibleTrades =
            trades.filter(
                trade =>
                    trade.eligible
            );


        const tradeSideScoring =
            scoreEligibleTradeSides(
                eligibleTrades
            );


        for (
            const trade
            of eligibleTrades
        ) {
            trade.comparison =
                buildTradeComparison(
                    trade
                );
        }


        const lineageStats =
            summarizeLineages(
                trades
            );


        return {
            phase:
                5,

            generatedAt:
                new Date()
                    .toISOString(),

            minimumTradeAgeYears:
                MIN_TRADE_AGE_YEARS,

            summary: {
                seasons:
                    seasons.length,

                transactions:
                    allTransactions.length,

                trades:
                    trades.length,

                eligibleTrades:
                    eligibleTrades.length,

                completedDrafts:
                    drafts.length,

                resolvedDraftPicks:
                    Object.keys(
                        draftPickLookup
                    ).length,

                lineageNodes:
                    lineageStats.nodes,

                lineageDrops:
                    lineageStats.drops,

                lineageRetrades:
                    lineageStats.retrades,

                lineageStillHeld:
                    lineageStats.stillHeld,

                unresolvedDispositions:
                    lineageStats.unresolved,

                realizedRosterPoints:
                    lineageStats.realizedPoints,

                rosteredPlayerWeeks:
                    lineageStats.rosteredWeeks,

                missingPointWeeks:
                    lineageStats.missingPointWeeks,

                normalizedPlayerStints:
                    lineageStats.normalizedPlayerStints,

                missingPositionStints:
                    lineageStats.missingPositionStints,

                positionalValueUnits:
                    lineageStats.positionalValueUnits,

                scoredTradeSides:
                    tradeSideScoring.scoredSides,

                tradeSideScorePool:
                    tradeSideScoring.poolSize,

                averageWhatWeKnowNow:
                    tradeSideScoring.averageScore
            },

            currentSeasonState:
                nflState,

            scoreMethodology: {
                evenMaxGap:
                    EVEN_MAX_GAP,

                slightEdgeMaxGap:
                    SLIGHT_EDGE_MAX_GAP,

                clearWinMaxGap:
                    CLEAR_WIN_MAX_GAP
            },

            validations:
                seasonPackages.map(
                    season =>
                        season.validation
                ),

            trades:
                trades
                    .sort(
                        compareTradesDescending
                    ),

            eligibleTrades:
                eligibleTrades
                    .sort(
                        compareTradesDescending
                    ),

            draftPickLookup
        };
    };



const getCurrentNflState =
    async () => {

        try {
            const response =
                await fetch(
                    'https://api.sleeper.app/v1/state/nfl',
                    {
                        compress:
                            true
                    }
                );


            if (!response.ok) {
                return null;
            }


            const state =
                await response.json();


            const season =
                Number(
                    state
                        ?.league_season ||
                    state
                        ?.season
                );


            const week =
                Number(
                    state
                        ?.week
                );


            const seasonType =
                String(
                    state
                        ?.season_type ||
                    ''
                )
                    .trim()
                    .toLowerCase();


            let lastCompletedWeek =
                null;


            if (
                seasonType ===
                    'pre' ||
                seasonType ===
                    'preseason'
            ) {
                lastCompletedWeek =
                    0;
            }
            else if (
                seasonType ===
                    'regular'
            ) {
                lastCompletedWeek =
                    Number.isFinite(
                        week
                    )
                        ? Math.max(
                            0,
                            week -
                            1
                        )
                        : null;
            }
            else if (
                seasonType ===
                    'post' ||
                seasonType ===
                    'postseason'
            ) {
                /*
                    The NFL regular season is complete.
                    The league-specific final-week cap is
                    applied separately.
                */

                lastCompletedWeek =
                    18;
            }


            return {
                season:
                    Number.isFinite(
                        season
                    )
                        ? season
                        : null,

                week:
                    Number.isFinite(
                        week
                    )
                        ? week
                        : null,

                seasonType:
                    seasonType ||
                    null,

                lastCompletedWeek
            };
        }
        catch {
            return null;
        }
    };


/*
    =====================================================
    HISTORICAL LEAGUE CHAIN
    =====================================================
*/

const getHistoricalLeagueChain =
    async () => {

        const seasons =
            [];


        let currentLeagueID =
            leagueID;


        const visited =
            new Set();


        while (
            currentLeagueID &&
            currentLeagueID != 0 &&
            !visited.has(
                String(
                    currentLeagueID
                )
            )
        ) {
            visited.add(
                String(
                    currentLeagueID
                )
            );


            const leagueData =
                await getLeagueData(
                    currentLeagueID
                );


            if (!leagueData) {
                break;
            }


            const playoffStart =
                Number(
                    leagueData
                        ?.settings
                        ?.playoff_week_start
                ) ||
                null;


            const playoffRounds =
                await getPlayoffRoundCount(
                    String(
                        currentLeagueID
                    )
                );


            const finalLeagueWeek =
                (
                    playoffStart &&
                    playoffRounds
                )
                    ? (
                        playoffStart +
                        playoffRounds -
                        1
                    )
                    : null;


            seasons.push({
                leagueID:
                    String(
                        currentLeagueID
                    ),

                year:
                    Number(
                        leagueData.season
                    ),

                playoffStart,

                playoffRounds,

                finalLeagueWeek
            });


            currentLeagueID =
                leagueData
                    .previous_league_id;
        }


        return seasons.sort(
            (
                a,
                b
            ) =>
                a.year -
                b.year
        );
    };



const getPlayoffRoundCount =
    async leagueID => {

        try {
            const response =
                await fetch(
                    (
                        `https://api.sleeper.app/v1/league/` +
                        `${leagueID}/winners_bracket`
                    ),
                    {
                        compress:
                            true
                    }
                );


            if (!response.ok) {
                return null;
            }


            const bracket =
                await response.json();


            if (
                !Array.isArray(
                    bracket
                ) ||
                !bracket.length
            ) {
                return null;
            }


            const rounds =
                bracket
                    .map(
                        matchup =>
                            Number(
                                matchup?.r
                            )
                    )
                    .filter(
                        Number.isFinite
                    );


            return rounds.length
                ? Math.max(
                    ...rounds
                )
                : null;
        }
        catch {
            return null;
        }
    };


/*
    =====================================================
    LOAD ONE SEASON
    =====================================================
*/

const loadSeasonPackage =
    async (
        season,
        nflState = null
    ) => {

        const [
            transactions,
            drafts,
            matchupPackage
        ] =
            await Promise.all([
                loadSeasonTransactions(
                    season
                ),

                loadSeasonDrafts(
                    season
                ),

                loadSeasonMatchups(
                    season,
                    nflState
                )
            ]);


        const tradeTransactions =
            transactions.filter(
                transaction =>
                    transaction.type ===
                        'trade' &&
                    transaction.status !==
                        'failed'
            );


        const officialDrops =
            transactions.reduce(
                (
                    total,
                    transaction
                ) =>
                    total +
                    countTrueDrops(
                        transaction
                    ),
                0
            );


        const pickMoves =
            transactions.reduce(
                (
                    total,
                    transaction
                ) =>
                    total +
                    (
                        Array.isArray(
                            transaction.draft_picks
                        )
                            ? transaction
                                .draft_picks
                                .length
                            : 0
                    ),
                0
            );


        return {
            ...season,

            transactions,

            drafts,

            matchupRows:
                matchupPackage.rows,

            validation: {
                year:
                    season.year,

                leagueID:
                    season.leagueID,

                transactionRoundsScanned:
                    (
                        MAX_TRANSACTION_ROUND -
                        MIN_TRANSACTION_ROUND +
                        1
                    ),

                transactions:
                    transactions.length,

                trades:
                    tradeTransactions.length,

                officialDrops,

                draftPickMoves:
                    pickMoves,

                completedDrafts:
                    drafts.length,

                playoffStart:
                    season.playoffStart,

                playoffRounds:
                    season.playoffRounds,

                finalLeagueWeek:
                    season.finalLeagueWeek,

                currentSeasonLastCompletedWeek:
                    (
                        Number(
                            season.year
                        ) ===
                        Number(
                            nflState
                                ?.season
                        )
                    )
                        ? nflState
                            ?.lastCompletedWeek
                        : null,

                matchup:
                    matchupPackage.validation
            }
        };
    };


/*
    =====================================================
    TRANSACTIONS
    =====================================================
*/

const loadSeasonTransactions =
    async season => {

        const requests =
            [];


        for (
            let round =
                MIN_TRANSACTION_ROUND;
            round <=
                MAX_TRANSACTION_ROUND;
            round++
        ) {
            requests.push(
                fetch(
                    (
                        `https://api.sleeper.app/v1/league/` +
                        `${season.leagueID}/transactions/${round}`
                    ),
                    {
                        compress:
                            true
                    }
                )
                    .then(
                        async response => ({
                            round,

                            ok:
                                response.ok,

                            data:
                                response.ok
                                    ? await response.json()
                                    : []
                        })
                    )
                    .catch(
                        () => ({
                            round,

                            ok:
                                false,

                            data:
                                []
                        })
                    )
            );
        }


        const results =
            await Promise.all(
                requests
            );


        const transactions =
            [];


        for (
            const result
            of results
        ) {
            if (
                !result.ok ||
                !Array.isArray(
                    result.data
                )
            ) {
                continue;
            }


            for (
                const transaction
                of result.data
            ) {
                transactions.push({
                    ...transaction,

                    _sourceLeagueID:
                        season.leagueID,

                    _sourceSeason:
                        season.year,

                    _sourceRound:
                        result.round
                });
            }
        }


        return dedupeTransactions(
            transactions
        );
    };


const dedupeTransactions =
    transactions => {

        const map =
            new Map();


        for (
            const transaction
            of transactions
        ) {
            const key =
                String(
                    transaction
                        ?.transaction_id ||
                    (
                        `${transaction?._sourceLeagueID}|` +
                        `${transaction?._sourceRound}|` +
                        `${transaction?.status_updated}|` +
                        `${transaction?.type}`
                    )
                );


            if (
                !map.has(
                    key
                )
            ) {
                map.set(
                    key,
                    transaction
                );
            }
        }


        return [
            ...map.values()
        ];
    };


const countTrueDrops =
    transaction => {

        const drops =
            transaction.drops ||
            {};


        const adds =
            transaction.adds ||
            {};


        let count =
            0;


        for (
            const playerID
            of Object.keys(
                drops
            )
        ) {
            if (
                !Object.prototype
                    .hasOwnProperty
                    .call(
                        adds,
                        playerID
                    )
            ) {
                count++;
            }
        }


        return count;
    };


/*
    =====================================================
    HISTORICAL DRAFTS
    =====================================================
*/

const loadSeasonDrafts =
    async season => {

        try {
            const response =
                await fetch(
                    (
                        `https://api.sleeper.app/v1/league/` +
                        `${season.leagueID}/drafts`
                    ),
                    {
                        compress:
                            true
                    }
                );


            if (!response.ok) {
                return [];
            }


            const draftList =
                await response.json();


            if (
                !Array.isArray(
                    draftList
                )
            ) {
                return [];
            }


            const completed =
                draftList.filter(
                    draft =>
                        draft.status ===
                        'complete'
                );


            const packages =
                await Promise.all(
                    completed.map(
                        async draftInfo => {

                            const draftID =
                                draftInfo
                                    .draft_id;


                            const [
                                infoResponse,
                                picksResponse
                            ] =
                                await Promise.all([
                                    fetch(
                                        `https://api.sleeper.app/v1/draft/${draftID}`,
                                        {
                                            compress:
                                                true
                                        }
                                    ),

                                    fetch(
                                        `https://api.sleeper.app/v1/draft/${draftID}/picks`,
                                        {
                                            compress:
                                                true
                                        }
                                    )
                                ]);


                            if (
                                !infoResponse.ok ||
                                !picksResponse.ok
                            ) {
                                return null;
                            }


                            const [
                                info,
                                picks
                            ] =
                                await Promise.all([
                                    infoResponse.json(),

                                    picksResponse.json()
                                ]);


                            return {
                                draftID,

                                season:
                                    Number(
                                        info.season ||
                                        draftInfo.season ||
                                        season.year
                                    ),

                                type:
                                    info.type ||
                                    draftInfo.type ||
                                    null,

                                startTime:
                                    normalizeTimestamp(
                                        info.start_time ||
                                        draftInfo.start_time
                                    ),

                                slotToRosterID:
                                    info
                                        .slot_to_roster_id ||
                                    {},

                                picks:
                                    Array.isArray(
                                        picks
                                    )
                                        ? picks
                                        : []
                            };
                        }
                    )
                );


            return packages.filter(
                Boolean
            );
        }
        catch {
            return [];
        }
    };


/*
    =====================================================
    CANONICAL DRAFT PICK LOOKUP
    =====================================================
*/

const buildDraftPickLookup =
    drafts => {

        const lookup =
            {};


        for (
            const draft
            of drafts
        ) {
            for (
                const pick
                of draft.picks
            ) {
                const round =
                    Number(
                        pick.round
                    );


                const slot =
                    Number(
                        pick.draft_slot
                    );


                const originalRosterID =
                    Number(
                        draft
                            .slotToRosterID
                            ?.[slot]
                    );


                if (
                    !Number.isFinite(
                        round
                    ) ||
                    !Number.isFinite(
                        originalRosterID
                    )
                ) {
                    continue;
                }


                const key =
                    makePickKey(
                        draft.season,
                        round,
                        originalRosterID
                    );


                lookup[
                    key
                ] = {
                    key,

                    season:
                        Number(
                            draft.season
                        ),

                    round,

                    originalRosterID,

                    draftID:
                        draft.draftID,

                    draftTimestamp:
                        draft.startTime ||
                        fallbackDraftTimestamp(
                            draft.season
                        ),

                    draftSlot:
                        slot,

                    pickNo:
                        Number(
                            pick.pick_no
                        ) ||
                        null,

                    selectedPlayerID:
                        pick.player_id
                            ? String(
                                pick.player_id
                            )
                            : null,

                    selectingRosterID:
                        Number(
                            pick.roster_id
                        ) ||
                        null
                };
            }
        }


        return lookup;
    };


const makePickKey = (
    season,
    round,
    originalRosterID
) => {

    return (
        `${Number(season)}|` +
        `${Number(round)}|` +
        `${Number(originalRosterID)}`
    );
};


/*
    =====================================================
    CURRENT ROSTERS
    =====================================================
*/

const loadCurrentRosterPlayers =
    async currentLeagueID => {

        try {
            const response =
                await fetch(
                    (
                        `https://api.sleeper.app/v1/league/` +
                        `${currentLeagueID}/rosters`
                    ),
                    {
                        compress:
                            true
                    }
                );


            if (!response.ok) {
                return {};
            }


            const rosters =
                await response.json();


            if (
                !Array.isArray(
                    rosters
                )
            ) {
                return {};
            }


            const result =
                {};


            for (
                const roster
                of rosters
            ) {
                result[
                    Number(
                        roster.roster_id
                    )
                ] =
                    new Set(
                        (
                            Array.isArray(
                                roster.players
                            )
                                ? roster.players
                                : []
                        )
                            .map(
                                String
                            )
                    );
            }


            return result;
        }
        catch {
            return {};
        }
    };


/*
    =====================================================
    HISTORICAL MATCHUPS / REALIZED POINTS
    =====================================================

    Sleeper preserves a weekly roster snapshot in each
    matchup row. Phase 3 uses that snapshot as the source
    of truth for whether a player was rostered that week.

    We count players_points[playerID] whenever:
      1. the player appears on that roster's players list
      2. the week falls inside this specific ownership
         segment of the lineage

    This prevents a later reacquisition from accidentally
    adding points from an earlier stint.
    =====================================================
*/

const loadSeasonMatchups =
    async (
        season,
        nflState = null
    ) => {

        const configuredLastWeek =
            (
                Number.isFinite(
                    Number(
                        season.finalLeagueWeek
                    )
                ) &&
                Number(
                    season.finalLeagueWeek
                ) >
                    0
            )
                ? Number(
                    season.finalLeagueWeek
                )
                : 18;


        const isCurrentSeason =
            (
                Number.isFinite(
                    Number(
                        nflState
                            ?.season
                    )
                ) &&
                Number(
                    season.year
                ) ===
                    Number(
                        nflState.season
                    )
            );


        const currentCompletedWeek =
            (
                isCurrentSeason &&
                Number.isFinite(
                    Number(
                        nflState
                            ?.lastCompletedWeek
                    )
                )
            )
                ? Math.max(
                    0,
                    Number(
                        nflState.lastCompletedWeek
                    )
                )
                : null;


        const lastWeek =
            currentCompletedWeek ===
                null
                ? configuredLastWeek
                : Math.min(
                    configuredLastWeek,
                    currentCompletedWeek
                );


        const weeks =
            Array.from(
                {
                    length:
                        lastWeek
                },
                (
                    _,
                    index
                ) =>
                    index + 1
            );


        const results =
            await mapWithConcurrency(
                weeks,
                6,
                async week => {

                    try {
                        const response =
                            await fetch(
                                (
                                    `https://api.sleeper.app/v1/league/` +
                                    `${season.leagueID}/matchups/${week}`
                                ),
                                {
                                    compress:
                                        true
                                }
                            );


                        if (!response.ok) {
                            return {
                                week,

                                rows:
                                    []
                            };
                        }


                        const data =
                            await response.json();


                        return {
                            week,

                            rows:
                                Array.isArray(
                                    data
                                )
                                    ? data
                                    : []
                        };
                    }
                    catch {
                        return {
                            week,

                            rows:
                                []
                        };
                    }
                }
            );


        const rows =
            [];


        for (
            const result
            of results
        ) {
            for (
                const row
                of result.rows
            ) {
                rows.push({
                    ...row,

                    _season:
                        season.year,

                    _week:
                        result.week,

                    _leagueID:
                        season.leagueID
                });
            }
        }


        const sample =
            rows.find(
                row =>
                    row &&
                    (
                        Array.isArray(
                            row.players
                        ) ||
                        Array.isArray(
                            row.starters
                        )
                    )
            ) ||
            null;


        const weeksWithRows =
            new Set(
                rows.map(
                    row =>
                        row._week
                )
            );


        let rosteredPlayerWeeks =
            0;


        let playerPointWeeks =
            0;


        let missingPointWeeks =
            0;


        for (
            const row
            of rows
        ) {
            const players =
                Array.isArray(
                    row.players
                )
                    ? row.players
                    : [];


            for (
                const rawPlayerID
                of players
            ) {
                const playerID =
                    String(
                        rawPlayerID
                    );


                rosteredPlayerWeeks++;


                const score =
                    readPlayerPoints(
                        row,
                        playerID
                    );


                if (
                    score ===
                    null
                ) {
                    missingPointWeeks++;
                }
                else {
                    playerPointWeeks++;
                }
            }
        }


        return {
            rows,

            validation: {
                sampledWeek:
                    sample
                        ? sample._week
                        : null,

                rowCount:
                    rows.length,

                weeksWithRows:
                    weeksWithRows.size,

                requestedThroughWeek:
                    lastWeek,

                currentSeasonCapApplied:
                    currentCompletedWeek !==
                    null,

                hasPlayers:
                    Array.isArray(
                        sample
                            ?.players
                    ),

                hasStarters:
                    Array.isArray(
                        sample
                            ?.starters
                    ),

                hasPlayersPoints:
                    Boolean(
                        sample &&
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                sample,
                                'players_points'
                            )
                    ),

                playersPointsType:
                    getValueType(
                        sample
                            ?.players_points
                    ),

                hasStartersPoints:
                    Boolean(
                        sample &&
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                sample,
                                'starters_points'
                            )
                    ),

                startersPointsType:
                    getValueType(
                        sample
                            ?.starters_points
                    ),

                rosteredPlayerWeeks,

                playerPointWeeks,

                missingPointWeeks
            }
        };
    };


const buildProductionLookup =
    seasonPackages => {

        const lookup =
            {};


        for (
            const season
            of seasonPackages
        ) {
            const year =
                Number(
                    season.year
                );


            if (
                !lookup[
                    year
                ]
            ) {
                lookup[
                    year
                ] =
                    {};
            }


            for (
                const row
                of season.matchupRows ||
                []
            ) {
                const week =
                    Number(
                        row._week
                    );


                const rosterID =
                    Number(
                        row.roster_id
                    );


                if (
                    !Number.isFinite(
                        week
                    ) ||
                    !Number.isFinite(
                        rosterID
                    )
                ) {
                    continue;
                }


                if (
                    !lookup[
                        year
                    ][
                        week
                    ]
                ) {
                    lookup[
                        year
                    ][
                        week
                    ] =
                        {};
                }


                const players =
                    Array.isArray(
                        row.players
                    )
                        ? row.players
                        : [];


                const playerMap =
                    {};


                for (
                    const rawPlayerID
                    of players
                ) {
                    const playerID =
                        String(
                            rawPlayerID
                        );


                    playerMap[
                        playerID
                    ] = {
                        rostered:
                            true,

                        points:
                            readPlayerPoints(
                                row,
                                playerID
                            )
                    };
                }


                lookup[
                    year
                ][
                    week
                ][
                    rosterID
                ] =
                    playerMap;
            }
        }


        return lookup;
    };


const readPlayerPoints = (
    row,
    playerID
) => {

    const points =
        row
            ?.players_points;


    if (
        !points ||
        typeof points !==
            'object' ||
        Array.isArray(
            points
        )
    ) {
        return null;
    }


    const raw =
        points[
            playerID
        ];


    if (
        raw ===
            null ||
        raw ===
            undefined ||
        raw ===
            ''
    ) {
        return null;
    }


    const number =
        Number(
            raw
        );


    return Number.isFinite(
        number
    )
        ? number
        : null;
};


const getPlayerProduction =
    ({
        playerID,
        rosterID,
        startSeason,
        startRound,
        endSeason = null,
        endRound = null,
        productionLookup,
        playerCatalog = {}
    }) => {

        let points =
            0;


        let rosteredWeeks =
            0;


        let scoredWeeks =
            0;


        let missingPointWeeks =
            0;


        const seasons =
            new Set();


        const weekly =
            [];


        const startYear =
            Number(
                startSeason
            );


        const startWeek =
            Number.isFinite(
                Number(
                    startRound
                )
            )
                ? Number(
                    startRound
                )
                : 0;


        const finalYear =
            endSeason !==
                null &&
            endSeason !==
                undefined &&
            Number.isFinite(
                Number(
                    endSeason
                )
            )
                ? Number(
                    endSeason
                )
                : null;


        const finalWeek =
            endRound !==
                null &&
            endRound !==
                undefined &&
            Number.isFinite(
                Number(
                    endRound
                )
            )
                ? Number(
                    endRound
                )
                : null;


        const years =
            Object.keys(
                productionLookup ||
                {}
            )
                .map(
                    Number
                )
                .filter(
                    Number.isFinite
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        a -
                        b
                );


        for (
            const year
            of years
        ) {
            if (
                Number.isFinite(
                    startYear
                ) &&
                year <
                    startYear
            ) {
                continue;
            }


            if (
                finalYear !==
                    null &&
                year >
                    finalYear
            ) {
                continue;
            }


            const weeks =
                Object.keys(
                    productionLookup
                        ?.[year] ||
                    {}
                )
                    .map(
                        Number
                    )
                    .filter(
                        Number.isFinite
                    )
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            a -
                            b
                    );


            for (
                const week
                of weeks
            ) {
                if (
                    year ===
                        startYear &&
                    week <
                        Math.max(
                            1,
                            startWeek
                        )
                ) {
                    continue;
                }


                if (
                    finalYear !==
                        null &&
                    year ===
                        finalYear &&
                    finalWeek !==
                        null &&
                    week >
                        finalWeek
                ) {
                    continue;
                }


                const playerWeek =
                    productionLookup
                        ?.[year]
                        ?.[week]
                        ?.[rosterID]
                        ?.[String(
                            playerID
                        )];


                if (
                    !playerWeek
                        ?.rostered
                ) {
                    continue;
                }


                rosteredWeeks++;


                seasons.add(
                    year
                );


                if (
                    playerWeek.points ===
                    null
                ) {
                    missingPointWeeks++;


                    weekly.push({
                        season:
                            year,

                        week,

                        points:
                            null
                    });


                    continue;
                }


                points +=
                    playerWeek.points;


                scoredWeeks++;


                weekly.push({
                    season:
                        year,

                    week,

                    points:
                        roundPoints(
                            playerWeek.points
                        )
                });
            }
        }


        const rawProduction = {
            points:
                roundPoints(
                    points
                ),

            rosteredWeeks,

            scoredWeeks,

            missingPointWeeks,

            seasons:
                [
                    ...seasons
                ]
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            a -
                            b
                    ),

            weekly
        };


        const position =
            normalizePosition(
                playerCatalog
                    ?.[String(
                        playerID
                    )]
                    ?.pos
            );


        const positional =
            getPositionalComparison({
                playerID:
                    String(
                        playerID
                    ),

                position,

                production:
                    rawProduction,

                productionLookup,

                playerCatalog
            });


        return {
            ...rawProduction,

            position,

            ...positional
        };
    };



const getPositionalComparison =
    ({
        playerID,
        position,
        production,
        productionLookup,
        playerCatalog
    }) => {

        if (
            !position ||
            !production
                ?.weekly
                ?.length
        ) {
            return {
                positionScore:
                    null,

                positionRank:
                    null,

                positionRankEnd:
                    null,

                positionPool:
                    0,

                positionMedianPoints:
                    null,

                positionAveragePoints:
                    null,

                pointsAboveMedian:
                    null,

                positionalValue:
                    0,

                comparisonWeeks:
                    production
                        ?.weekly
                        ?.length ||
                    0
            };
        }


        /*
            Aggregate every same-position player over the
            focal player's exact rostered weeks.

            One player can move between rosters during a
            week, so year|week|player is de-duplicated.
        */

        const totals =
            new Map();


        const seenPlayerWeeks =
            new Set();


        for (
            const focalWeek
            of production.weekly
        ) {
            const year =
                Number(
                    focalWeek.season
                );


            const week =
                Number(
                    focalWeek.week
                );


            const rosterMaps =
                productionLookup
                    ?.[year]
                    ?.[week] ||
                {};


            for (
                const rosterPlayers
                of Object.values(
                    rosterMaps
                )
            ) {
                for (
                    const [
                        comparisonPlayerID,
                        playerWeek
                    ]
                    of Object.entries(
                        rosterPlayers ||
                        {}
                    )
                ) {
                    if (
                        !playerWeek
                            ?.rostered
                    ) {
                        continue;
                    }


                    const comparisonPosition =
                        normalizePosition(
                            playerCatalog
                                ?.[String(
                                    comparisonPlayerID
                                )]
                                ?.pos
                        );


                    if (
                        comparisonPosition !==
                        position
                    ) {
                        continue;
                    }


                    const playerWeekKey =
                        (
                            `${year}|${week}|` +
                            `${comparisonPlayerID}`
                        );


                    if (
                        seenPlayerWeeks.has(
                            playerWeekKey
                        )
                    ) {
                        continue;
                    }


                    seenPlayerWeeks.add(
                        playerWeekKey
                    );


                    const existing =
                        totals.get(
                            String(
                                comparisonPlayerID
                            )
                        ) ||
                        {
                            playerID:
                                String(
                                    comparisonPlayerID
                                ),

                            points:
                                0,

                            rosteredWeeks:
                                0,

                            scoredWeeks:
                                0
                        };


                    existing.rosteredWeeks++;


                    if (
                        playerWeek.points !==
                        null
                    ) {
                        existing.points +=
                            Number(
                                playerWeek.points
                            ) ||
                            0;


                        existing.scoredWeeks++;
                    }


                    totals.set(
                        String(
                            comparisonPlayerID
                        ),
                        existing
                    );
                }
            }
        }


        /*
            The focal player should normally already exist
            in the pool. Keep a deterministic fallback so a
            partial historical payload cannot silently make
            the player's own comparison disappear.
        */

        if (
            !totals.has(
                String(
                    playerID
                )
            )
        ) {
            totals.set(
                String(
                    playerID
                ),
                {
                    playerID:
                        String(
                            playerID
                        ),

                    points:
                        Number(
                            production.points
                        ) ||
                        0,

                    rosteredWeeks:
                        Number(
                            production.rosteredWeeks
                        ) ||
                        0,

                    scoredWeeks:
                        Number(
                            production.scoredWeeks
                        ) ||
                        0
                }
            );
        }


        const comparisonTotals =
            [
                ...totals.values()
            ]
                .map(
                    item => ({
                        ...item,

                        points:
                            roundPoints(
                                item.points
                            )
                    })
                );


        const pointValues =
            comparisonTotals
                .map(
                    item =>
                        Number(
                            item.points
                        ) ||
                        0
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        a -
                        b
                );


        const focalPoints =
            Number(
                production.points
            ) ||
            0;


        const pool =
            pointValues.length;


        const less =
            pointValues.filter(
                value =>
                    value <
                    focalPoints
            ).length;


        const equal =
            pointValues.filter(
                value =>
                    Math.abs(
                        value -
                        focalPoints
                    ) <
                    0.000001
            ).length;


        const greater =
            pointValues.filter(
                value =>
                    value >
                    focalPoints
            ).length;


        let positionScore =
            null;


        if (
            pool ===
            1
        ) {
            positionScore =
                100;
        }
        else if (
            pool >
            1
        ) {
            const averageAscendingIndex =
                less +
                (
                    Math.max(
                        1,
                        equal
                    ) -
                    1
                ) /
                2;


            positionScore =
                roundScore(
                    100 *
                    averageAscendingIndex /
                    (
                        pool -
                        1
                    )
                );
        }


        const median =
            medianValue(
                pointValues
            );


        const average =
            pool
                ? pointValues.reduce(
                    (
                        sum,
                        value
                    ) =>
                        sum +
                        value,
                    0
                ) /
                pool
                : null;


        const positionalValue =
            positionScore ===
                null
                ? 0
                : (
                    (
                        Number(
                            production
                                .rosteredWeeks
                        ) ||
                        0
                    ) *
                    (
                        positionScore /
                        100
                    )
                );


        return {
            positionScore,

            positionRank:
                pool
                    ? greater +
                        1
                    : null,

            positionRankEnd:
                pool
                    ? greater +
                        Math.max(
                            1,
                            equal
                        )
                    : null,

            positionPool:
                pool,

            positionMedianPoints:
                median ===
                    null
                    ? null
                    : roundPoints(
                        median
                    ),

            positionAveragePoints:
                average ===
                    null
                    ? null
                    : roundPoints(
                        average
                    ),

            pointsAboveMedian:
                median ===
                    null
                    ? null
                    : roundPoints(
                        focalPoints -
                        median
                    ),

            positionalValue:
                roundValue(
                    positionalValue
                ),

            comparisonWeeks:
                production
                    .weekly
                    .length
        };
    };


const normalizePosition =
    value => {

        const position =
            String(
                value ||
                ''
            )
                .trim()
                .toUpperCase();


        if (!position) {
            return null;
        }


        if (
            position ===
                'D/ST' ||
            position ===
                'DST'
        ) {
            return 'DEF';
        }


        return position;
    };


const medianValue =
    values => {

        if (
            !Array.isArray(
                values
            ) ||
            !values.length
        ) {
            return null;
        }


        const middle =
            Math.floor(
                values.length /
                2
            );


        if (
            values.length %
            2
        ) {
            return values[
                middle
            ];
        }


        return (
            values[
                middle -
                1
            ] +
            values[
                middle
            ]
        ) /
        2;
    };


const roundScore =
    value => {

        return Math.round(
            (
                Number(
                    value
                ) ||
                0
            ) *
            10
        ) /
        10;
    };


const roundValue =
    value => {

        return Math.round(
            (
                Number(
                    value
                ) ||
                0
            ) *
            1000
        ) /
        1000;
    };


const roundPoints =
    value => {

        return Math.round(
            (
                Number(
                    value
                ) ||
                0
            ) *
            100
        ) /
        100;
    };


const getValueType =
    value => {

        if (
            Array.isArray(
                value
            )
        ) {
            return 'array';
        }


        if (
            value ===
            null
        ) {
            return 'null';
        }


        return typeof value;
    };


const mapWithConcurrency =
    async (
        items,
        limit,
        mapper
    ) => {

        const results =
            new Array(
                items.length
            );


        let nextIndex =
            0;


        const workers =
            Array.from(
                {
                    length:
                        Math.max(
                            1,
                            Math.min(
                                limit,
                                items.length ||
                                1
                            )
                        )
                },
                async () => {

                    while (
                        nextIndex <
                        items.length
                    ) {
                        const currentIndex =
                            nextIndex++;


                        results[
                            currentIndex
                        ] =
                            await mapper(
                                items[
                                    currentIndex
                                ],
                                currentIndex
                            );
                    }
                }
            );


        await Promise.all(
            workers
        );


        return results;
    };


/*
    =====================================================
    TRADE
    =====================================================
*/

const digestTrade = ({
    transaction,
    teamManagers,
    draftPickLookup,
    lineageContext
}) => {

    const timestamp =
        normalizeTimestamp(
            transaction.status_updated
        );


    const season =
        Number(
            transaction
                ._sourceSeason
        );


    const rosters =
        (
            Array.isArray(
                transaction.roster_ids
            )
                ? transaction.roster_ids
                : []
        )
            .map(
                Number
            )
            .filter(
                Number.isFinite
            );


    const participants =
        rosters.map(
            rosterID => {

                const rawAssets =
                    extractParticipantAssets(
                        transaction,
                        rosterID,
                        draftPickLookup
                    );


                /*
                    This set is shared by every root asset
                    for ONE participant in this original
                    trade. It prevents a later bundled
                    trade from spawning the same return
                    multiple times.
                */

                const consumedReplacementTrades =
                    new Set();


                const receivedLineages =
                    rawAssets
                        .received
                        .map(
                            asset =>
                                followAsset({
                                    asset,

                                    rosterID,

                                    acquiredAt:
                                        timestamp,

                                    acquiredSeason:
                                        season,

                                    acquiredRound:
                                        Number(
                                            transaction
                                                ._sourceRound
                                        ),

                                    depth:
                                        0,

                                    lineageContext,

                                    consumedReplacementTrades,

                                    path:
                                        new Set()
                                })
                        );


                const realizedProduction =
                    summarizeParticipantProduction(
                        receivedLineages
                    );


                return {
                    rosterID,

                    team:
                        getTeamIdentity(
                            teamManagers,
                            season,
                            rosterID
                        ),

                    received:
                        rawAssets.received,

                    sent:
                        rawAssets.sent,

                    receivedLineages,

                    realizedProduction
                };
            }
        );


    return {
        id:
            String(
                transaction
                    .transaction_id
            ),

        season,

        sourceLeagueID:
            transaction
                ._sourceLeagueID,

        sourceRound:
            transaction
                ._sourceRound,

        timestamp,

        date:
            timestamp
                ? new Date(
                    timestamp
                )
                    .toISOString()
                : null,

        ageYears:
            getAgeYears(
                timestamp
            ),

        eligible:
            isOldEnough(
                timestamp
            ),

        rosterIDs:
            rosters,

        participants
    };
};


/*
    =====================================================
    EXTRACT ASSETS FOR ONE ROSTER IN A TRADE
    =====================================================
*/

const extractParticipantAssets = (
    transaction,
    rosterID,
    draftPickLookup
) => {

    const received =
        [];


    const sent =
        [];


    const adds =
        transaction.adds ||
        {};


    const drops =
        transaction.drops ||
        {};


    for (
        const [
            playerID,
            receivingRoster
        ]
        of Object.entries(
            adds
        )
    ) {
        if (
            Number(
                receivingRoster
            ) ===
            rosterID
        ) {
            received.push(
                makePlayerAsset(
                    playerID
                )
            );
        }
    }


    for (
        const [
            playerID,
            sendingRoster
        ]
        of Object.entries(
            drops
        )
    ) {
        if (
            Number(
                sendingRoster
            ) ===
                rosterID &&
            Object.prototype
                .hasOwnProperty
                .call(
                    adds,
                    playerID
                )
        ) {
            sent.push(
                makePlayerAsset(
                    playerID
                )
            );
        }
    }


    const draftPicks =
        Array.isArray(
            transaction.draft_picks
        )
            ? transaction.draft_picks
            : [];


    for (
        const pick
        of draftPicks
    ) {
        const asset =
            makePickAsset(
                pick,
                draftPickLookup
            );


        if (
            Number(
                pick.owner_id
            ) ===
            rosterID
        ) {
            received.push(
                asset
            );
        }


        if (
            Number(
                pick.previous_owner_id
            ) ===
            rosterID
        ) {
            sent.push(
                asset
            );
        }
    }


    const waiverBudget =
        Array.isArray(
            transaction.waiver_budget
        )
            ? transaction.waiver_budget
            : [];


    for (
        const budget
        of waiverBudget
    ) {
        if (
            Number(
                budget.receiver
            ) ===
            rosterID
        ) {
            received.push({
                assetType:
                    'budget',

                amount:
                    Number(
                        budget.amount
                    ) ||
                    0
            });
        }


        if (
            Number(
                budget.sender
            ) ===
            rosterID
        ) {
            sent.push({
                assetType:
                    'budget',

                amount:
                    Number(
                        budget.amount
                    ) ||
                    0
            });
        }
    }


    return {
        received,

        sent
    };
};


const makePlayerAsset =
    playerID => ({
        assetType:
            'player',

        playerID:
            String(
                playerID
            )
    });


const makePickAsset = (
    pick,
    draftPickLookup
) => {

    const season =
        Number(
            pick.season
        );


    const round =
        Number(
            pick.round
        );


    const originalRosterID =
        Number(
            pick.roster_id
        );


    const key =
        makePickKey(
            season,
            round,
            originalRosterID
        );


    return {
        assetType:
            'pick',

        key,

        season,

        round,

        originalRosterID,

        resolved:
            draftPickLookup[
                key
            ] ||
            null
    };
};


/*
    =====================================================
    RECURSIVE FOLLOWER
    =====================================================
*/

const followAsset = ({
    asset,
    rosterID,
    acquiredAt,
    acquiredSeason,
    acquiredRound,
    depth,
    lineageContext,
    consumedReplacementTrades,
    path
}) => {

    if (
        depth >
        MAX_LINEAGE_DEPTH
    ) {
        return {
            ...asset,

            status:
                'DEPTH LIMIT',

            children:
                []
        };
    }


    const pathKey =
        (
            `${assetIdentity(asset)}|` +
            `${rosterID}|` +
            `${acquiredAt}`
        );


    if (
        path.has(
            pathKey
        )
    ) {
        return {
            ...asset,

            status:
                'CYCLE BLOCKED',

            children:
                []
        };
    }


    const nextPath =
        new Set(
            path
        );


    nextPath.add(
        pathKey
    );


    if (
        asset.assetType ===
        'player'
    ) {
        return followPlayer({
            asset,

            rosterID,

            acquiredAt,

            acquiredSeason,

            acquiredRound,

            depth,

            lineageContext,

            consumedReplacementTrades,

            path:
                nextPath
        });
    }


    if (
        asset.assetType ===
        'pick'
    ) {
        return followPick({
            asset,

            rosterID,

            acquiredAt,

            acquiredSeason,

            acquiredRound,

            depth,

            lineageContext,

            consumedReplacementTrades,

            path:
                nextPath
        });
    }


    if (
        asset.assetType ===
        'budget'
    ) {
        return {
            ...asset,

            status:
                'FAAB RECEIVED',

            acquiredAt,

            acquiredSeason,

            acquiredRound,

            children:
                []
        };
    }


    return {
        ...asset,

        status:
            'UNKNOWN ASSET',

        children:
            []
    };
};


/*
    =====================================================
    PLAYER LINEAGE
    =====================================================
*/

const followPlayer = ({
    asset,
    rosterID,
    acquiredAt,
    acquiredSeason,
    acquiredRound,
    depth,
    lineageContext,
    consumedReplacementTrades,
    path
}) => {

    const disposition =
        findPlayerDisposition({
            playerID:
                asset.playerID,

            rosterID,

            after:
                acquiredAt,

            transactions:
                lineageContext
                    .transactions
        });


    const dispositionSeason =
        disposition
            ? Number(
                disposition
                    .transaction
                    ._sourceSeason
            )
            : null;


    const dispositionRound =
        disposition
            ? Number(
                disposition
                    .transaction
                    ._sourceRound
            )
            : null;


    const production =
        getPlayerProduction({
            playerID:
                asset.playerID,

            rosterID,

            startSeason:
                acquiredSeason,

            startRound:
                acquiredRound,

            endSeason:
                dispositionSeason,

            endRound:
                dispositionRound,

            productionLookup:
                lineageContext
                    .productionLookup,

            playerCatalog:
                lineageContext
                    .playerCatalog
        });


    if (!disposition) {
        const currentRoster =
            lineageContext
                .currentRosterPlayers
                ?.[rosterID];


        const stillHeld =
            currentRoster instanceof
                Set &&
            currentRoster.has(
                String(
                    asset.playerID
                )
            );


        return {
            ...asset,

            rosterID,

            acquiredAt,

            acquiredSeason,

            acquiredRound,

            production,

            status:
                stillHeld
                    ? 'STILL HELD'
                    : 'NO DISPOSITION FOUND',

            disposition:
                null,

            children:
                []
        };
    }


    const transaction =
        disposition.transaction;


    const timestamp =
        normalizeTimestamp(
            transaction.status_updated
        );


    /*
        Any non-trade removal is an official drop from
        this franchise's lineage, even if Sleeper happens
        to show another roster adding the player in the
        same transaction object.
    */

    if (
        transaction.type !==
        'trade' ||
        !disposition.wasTransferred
    ) {
        return {
            ...asset,

            rosterID,

            acquiredAt,

            acquiredSeason,

            acquiredRound,

            production,

            status:
                'DROPPED',

            disposition: {
                transactionID:
                    String(
                        transaction
                            .transaction_id
                    ),

                date:
                    timestamp
                        ? new Date(
                            timestamp
                        )
                            .toISOString()
                        : null,

                season:
                    transaction
                        ._sourceSeason,

                round:
                    transaction
                        ._sourceRound
            },

            children:
                []
        };
    }


    return continueThroughTrade({
        asset,

        rosterID,

        acquiredAt,

        acquiredSeason,

        acquiredRound,

        production,

        transaction,

        depth,

        lineageContext,

        consumedReplacementTrades,

        path
    });
};


/*
    =====================================================
    PICK LINEAGE
    =====================================================
*/

const followPick = ({
    asset,
    rosterID,
    acquiredAt,
    acquiredSeason,
    acquiredRound,
    depth,
    lineageContext,
    consumedReplacementTrades,
    path
}) => {

    const transfer =
        findPickTransfer({
            pickKey:
                asset.key,

            rosterID,

            after:
                acquiredAt,

            transactions:
                lineageContext
                    .transactions
        });


    if (transfer) {
        return continueThroughTrade({
            asset,

            rosterID,

            acquiredAt,

            acquiredSeason,

            acquiredRound,

            transaction:
                transfer.transaction,

            depth,

            lineageContext,

            consumedReplacementTrades,

            path
        });
    }


    const resolved =
        asset.resolved ||
        lineageContext
            .draftPickLookup
            ?.[asset.key] ||
        null;


    if (
        resolved &&
        resolved.selectedPlayerID
    ) {
        const draftTimestamp =
            resolved.draftTimestamp ||
            fallbackDraftTimestamp(
                resolved.season
            );


        if (
            Number(
                resolved.selectingRosterID
            ) !==
            Number(
                rosterID
            )
        ) {
            return {
                ...asset,

                rosterID,

                acquiredAt,

                acquiredSeason,

                acquiredRound,

                status:
                    'USED BY DIFFERENT ROSTER',

                selectedPlayerID:
                    resolved.selectedPlayerID,

                selectedByRosterID:
                    resolved.selectingRosterID,

                children:
                    []
            };
        }


        const selectedPlayer =
            makePlayerAsset(
                resolved.selectedPlayerID
            );


        return {
            ...asset,

            rosterID,

            acquiredAt,

            acquiredSeason,

            acquiredRound,

            status:
                'USED',

            selectedPlayerID:
                resolved.selectedPlayerID,

            draftSlot:
                resolved.draftSlot,

            pickNo:
                resolved.pickNo,

            disposition: {
                date:
                    draftTimestamp
                        ? new Date(
                            draftTimestamp
                        )
                            .toISOString()
                        : null,

                season:
                    resolved.season
            },

            children: [
                followAsset({
                    asset:
                        selectedPlayer,

                    rosterID,

                    acquiredAt:
                        draftTimestamp,

                    acquiredSeason:
                        resolved.season,

                    acquiredRound:
                        0,

                    depth:
                        depth + 1,

                    lineageContext,

                    consumedReplacementTrades,

                    path
                })
            ]
        };
    }


    return {
        ...asset,

        rosterID,

        acquiredAt,

        acquiredSeason,

        acquiredRound,

        status:
            'UNUSED / UNRESOLVED',

        children:
            []
    };
};


/*
    =====================================================
    CONTINUE THROUGH A LATER TRADE
    =====================================================
*/

const continueThroughTrade = ({
    asset,
    rosterID,
    acquiredAt,
    acquiredSeason,
    acquiredRound,
    production = null,
    transaction,
    depth,
    lineageContext,
    consumedReplacementTrades,
    path
}) => {

    const tradeID =
        String(
            transaction
                .transaction_id
        );


    const timestamp =
        normalizeTimestamp(
            transaction.status_updated
        );


    /*
        If another asset in this same original lineage
        already followed this later bundled trade, do not
        duplicate all of its descendants.
    */

    if (
        consumedReplacementTrades.has(
            tradeID
        )
    ) {
        return {
            ...asset,

            rosterID,

            acquiredAt,

            acquiredSeason,

            acquiredRound,

            ...(production
                ? {
                    production
                }
                : {}),

            status:
                'TRADED - SHARED CONTINUATION',

            disposition: {
                transactionID:
                    tradeID,

                date:
                    timestamp
                        ? new Date(
                            timestamp
                        )
                            .toISOString()
                        : null,

                season:
                    transaction
                        ._sourceSeason,

                round:
                    transaction
                        ._sourceRound
            },

            sharedContinuationTradeID:
                tradeID,

            children:
                []
        };
    }


    consumedReplacementTrades.add(
        tradeID
    );


    const assets =
        extractParticipantAssets(
            transaction,
            rosterID,
            lineageContext
                .draftPickLookup
        )
            .received;


    const children =
        assets.map(
            nextAsset =>
                followAsset({
                    asset:
                        nextAsset,

                    rosterID,

                    acquiredAt:
                        timestamp,

                    acquiredSeason:
                        Number(
                            transaction
                                ._sourceSeason
                        ),

                    acquiredRound:
                        Number(
                            transaction
                                ._sourceRound
                        ),

                    depth:
                        depth + 1,

                    lineageContext,

                    consumedReplacementTrades,

                    path
                })
        );


    return {
        ...asset,

        rosterID,

        acquiredAt,

        acquiredSeason,

        acquiredRound,

        ...(production
            ? {
                production
            }
            : {}),

        status:
            assets.length
                ? 'TRADED'
                : 'TRADED - NO TRACKED RETURN',

        disposition: {
            transactionID:
                tradeID,

            date:
                timestamp
                    ? new Date(
                        timestamp
                    )
                        .toISOString()
                    : null,

            season:
                transaction
                    ._sourceSeason,

            round:
                transaction
                    ._sourceRound
        },

        replacementAssets:
            assets.length,

        children
    };
};


/*
    =====================================================
    FIND PLAYER DISPOSITION
    =====================================================
*/

const findPlayerDisposition = ({
    playerID,
    rosterID,
    after,
    transactions
}) => {

    for (
        const transaction
        of transactions
    ) {
        const timestamp =
            normalizeTimestamp(
                transaction.status_updated
            );


        if (
            timestamp <=
            after
        ) {
            continue;
        }


        const drops =
            transaction.drops ||
            {};


        if (
            Number(
                drops[
                    playerID
                ]
            ) !==
            Number(
                rosterID
            )
        ) {
            continue;
        }


        const adds =
            transaction.adds ||
            {};


        const wasTransferred =
            Object.prototype
                .hasOwnProperty
                .call(
                    adds,
                    playerID
                ) &&
            Number(
                adds[
                    playerID
                ]
            ) !==
            Number(
                rosterID
            );


        return {
            transaction,

            wasTransferred
        };
    }


    return null;
};


/*
    =====================================================
    FIND PICK TRANSFER
    =====================================================
*/

const findPickTransfer = ({
    pickKey,
    rosterID,
    after,
    transactions
}) => {

    for (
        const transaction
        of transactions
    ) {
        const timestamp =
            normalizeTimestamp(
                transaction.status_updated
            );


        if (
            timestamp <=
            after
        ) {
            continue;
        }


        if (
            transaction.type !==
            'trade'
        ) {
            continue;
        }


        const picks =
            Array.isArray(
                transaction.draft_picks
            )
                ? transaction.draft_picks
                : [];


        for (
            const pick
            of picks
        ) {
            const key =
                makePickKey(
                    pick.season,
                    pick.round,
                    pick.roster_id
                );


            if (
                key ===
                    pickKey &&
                Number(
                    pick.previous_owner_id
                ) ===
                    Number(
                        rosterID
                    )
            ) {
                return {
                    transaction,

                    pick
                };
            }
        }
    }


    return null;
};


/*
    =====================================================
    TEAM IDENTITY
    =====================================================
*/

const getTeamIdentity = (
    teamManagers,
    season,
    rosterID
) => {

    const exact =
        teamManagers
            ?.teamManagersMap
            ?.[season]
            ?.[rosterID];


    if (exact) {
        return {
            name:
                exact.team
                    ?.name ||
                `Roster ${rosterID}`,

            avatar:
                exact.team
                    ?.avatar ||
                null,

            managers:
                Array.isArray(
                    exact.managers
                )
                    ? exact.managers
                    : []
        };
    }


    return {
        name:
            `Roster ${rosterID}`,

        avatar:
            null,

        managers:
            []
    };
};



const summarizeParticipantProduction =
    roots => {

        let points =
            0;


        let rosteredWeeks =
            0;


        let scoredWeeks =
            0;


        let missingPointWeeks =
            0;


        const players =
            new Set();


        const visit =
            node => {

                if (!node) {
                    return;
                }


                if (
                    node.assetType ===
                        'player' &&
                    node.production
                ) {
                    players.add(
                        String(
                            node.playerID
                        )
                    );


                    points +=
                        Number(
                            node
                                .production
                                .points
                        ) ||
                        0;


                    rosteredWeeks +=
                        Number(
                            node
                                .production
                                .rosteredWeeks
                        ) ||
                        0;


                    scoredWeeks +=
                        Number(
                            node
                                .production
                                .scoredWeeks
                        ) ||
                        0;


                    missingPointWeeks +=
                        Number(
                            node
                                .production
                                .missingPointWeeks
                        ) ||
                        0;
                }


                for (
                    const child
                    of node.children ||
                    []
                ) {
                    visit(
                        child
                    );
                }
            };


        for (
            const root
            of roots ||
            []
        ) {
            visit(
                root
            );
        }


        let positionalValue =
            0;


        let normalizedPlayerStints =
            0;


        const collectNormalized =
            node => {

                if (!node) {
                    return;
                }


                if (
                    node.assetType ===
                        'player' &&
                    node.production
                ) {
                    const value =
                        Number(
                            node
                                .production
                                .positionalValue
                        );


                    if (
                        Number.isFinite(
                            value
                        )
                    ) {
                        positionalValue +=
                            value;
                    }


                    if (
                        node
                            .production
                            .positionScore !==
                        null &&
                        node
                            .production
                            .positionScore !==
                        undefined
                    ) {
                        normalizedPlayerStints++;
                    }
                }


                for (
                    const child
                    of node.children ||
                    []
                ) {
                    collectNormalized(
                        child
                    );
                }
            };


        for (
            const root
            of roots ||
            []
        ) {
            collectNormalized(
                root
            );
        }


        return {
            points:
                roundPoints(
                    points
                ),

            rosteredWeeks,

            scoredWeeks,

            missingPointWeeks,

            uniquePlayers:
                players.size,

            positionalValue:
                roundValue(
                    positionalValue
                ),

            normalizedPlayerStints
        };
    };



/*
    =====================================================
    PHASE 5 - TRADE-SIDE HISTORICAL SCORE
    =====================================================
*/

const scoreEligibleTradeSides =
    eligibleTrades => {

        const sides =
            [];


        for (
            const trade
            of eligibleTrades ||
            []
        ) {
            for (
                const participant
                of trade.participants ||
                []
            ) {
                sides.push({
                    trade,

                    participant,

                    value:
                        Number(
                            participant
                                ?.realizedProduction
                                ?.positionalValue
                        ) ||
                        0
                });
            }
        }


        const values =
            sides
                .map(
                    side =>
                        side.value
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        a -
                        b
                );


        const poolSize =
            values.length;


        let scoreTotal =
            0;


        for (
            const side
            of sides
        ) {
            const less =
                values.filter(
                    value =>
                        value <
                        side.value
                ).length;


            const equal =
                values.filter(
                    value =>
                        Math.abs(
                            value -
                            side.value
                        ) <
                        0.000001
                ).length;


            const greater =
                values.filter(
                    value =>
                        value >
                        side.value
                ).length;


            let score =
                null;


            if (
                poolSize ===
                1
            ) {
                score =
                    100;
            }
            else if (
                poolSize >
                1
            ) {
                const averageAscendingIndex =
                    less +
                    (
                        Math.max(
                            1,
                            equal
                        ) -
                        1
                    ) /
                    2;


                score =
                    roundScore(
                        100 *
                        averageAscendingIndex /
                        (
                            poolSize -
                            1
                        )
                    );
            }


            side.participant.whatWeKnowNow = {
                score,

                positionalValue:
                    roundValue(
                        side.value
                    ),

                historicalRank:
                    poolSize
                        ? greater +
                            1
                        : null,

                historicalRankEnd:
                    poolSize
                        ? greater +
                            Math.max(
                                1,
                                equal
                            )
                        : null,

                poolSize
            };


            if (
                score !==
                    null &&
                score !==
                    undefined
            ) {
                scoreTotal +=
                    score;
            }
        }


        return {
            scoredSides:
                sides.length,

            poolSize,

            averageScore:
                sides.length
                    ? roundScore(
                        scoreTotal /
                        sides.length
                    )
                    : null
        };
    };


const buildTradeComparison =
    trade => {

        const scored =
            (
                trade.participants ||
                []
            )
                .filter(
                    participant =>
                        participant
                            ?.whatWeKnowNow
                            ?.score !==
                            null &&
                        participant
                            ?.whatWeKnowNow
                            ?.score !==
                            undefined
                )
                .map(
                    participant => ({
                        rosterID:
                            participant.rosterID,

                        team:
                            participant.team,

                        score:
                            Number(
                                participant
                                    .whatWeKnowNow
                                    .score
                            )
                    })
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b.score -
                        a.score
                );


        if (
            scored.length <
            2
        ) {
            return {
                label:
                    'NO COMPARISON',

                leaderRosterIDs:
                    scored.map(
                        item =>
                            item.rosterID
                    ),

                leaderTeamNames:
                    scored.map(
                        item =>
                            item.team
                                ?.name ||
                            `Roster ${item.rosterID}`
                    ),

                scoreGap:
                    null
            };
        }


        const top =
            scored[0];


        const second =
            scored[1];


        const scoreGap =
            roundScore(
                top.score -
                second.score
            );


        const tiedAtTop =
            scored.filter(
                item =>
                    Math.abs(
                        item.score -
                        top.score
                    ) <
                    0.000001
            );


        if (
            tiedAtTop.length >
            1
        ) {
            return {
                label:
                    'EVEN',

                leaderRosterIDs:
                    tiedAtTop.map(
                        item =>
                            item.rosterID
                    ),

                leaderTeamNames:
                    tiedAtTop.map(
                        item =>
                            item.team
                                ?.name ||
                            `Roster ${item.rosterID}`
                    ),

                scoreGap:
                    0
            };
        }


        let label =
            'LANDSLIDE';


        if (
            scoreGap <=
            EVEN_MAX_GAP
        ) {
            label =
                'EVEN';
        }
        else if (
            scoreGap <=
            SLIGHT_EDGE_MAX_GAP
        ) {
            label =
                'SLIGHT EDGE';
        }
        else if (
            scoreGap <=
            CLEAR_WIN_MAX_GAP
        ) {
            label =
                'CLEAR WIN';
        }


        return {
            label,

            leaderRosterIDs:
                label ===
                    'EVEN'
                    ? []
                    : [
                        top.rosterID
                    ],

            leaderTeamNames:
                label ===
                    'EVEN'
                    ? []
                    : [
                        top.team
                            ?.name ||
                        `Roster ${top.rosterID}`
                    ],

            scoreGap,

            topScore:
                top.score,

            secondScore:
                second.score
        };
    };


/*
    =====================================================
    SUMMARY
    =====================================================
*/

const summarizeLineages =
    trades => {

        const summary = {
            nodes:
                0,

            drops:
                0,

            retrades:
                0,

            stillHeld:
                0,

            unresolved:
                0,

            realizedPoints:
                0,

            rosteredWeeks:
                0,

            missingPointWeeks:
                0,

            normalizedPlayerStints:
                0,

            missingPositionStints:
                0,

            positionalValueUnits:
                0
        };


        const visit =
            node => {

                if (!node) {
                    return;
                }


                summary.nodes++;


                if (
                    node.assetType ===
                        'player' &&
                    node.production
                ) {
                    summary.realizedPoints +=
                        Number(
                            node
                                .production
                                .points
                        ) ||
                        0;


                    summary.rosteredWeeks +=
                        Number(
                            node
                                .production
                                .rosteredWeeks
                        ) ||
                        0;


                    summary.missingPointWeeks +=
                        Number(
                            node
                                .production
                                .missingPointWeeks
                        ) ||
                        0;


                    if (
                        node
                            .production
                            .positionScore !==
                            null &&
                        node
                            .production
                            .positionScore !==
                            undefined
                    ) {
                        summary.normalizedPlayerStints++;


                        summary.positionalValueUnits +=
                            Number(
                                node
                                    .production
                                    .positionalValue
                            ) ||
                            0;
                    }
                    else {
                        summary.missingPositionStints++;
                    }
                }


                if (
                    node.status ===
                    'DROPPED'
                ) {
                    summary.drops++;
                }


                if (
                    node.status ===
                        'TRADED' ||
                    node.status ===
                        'TRADED - SHARED CONTINUATION' ||
                    node.status ===
                        'TRADED - NO TRACKED RETURN'
                ) {
                    summary.retrades++;
                }


                if (
                    node.status ===
                    'STILL HELD'
                ) {
                    summary.stillHeld++;
                }


                if (
                    node.status ===
                        'NO DISPOSITION FOUND' ||
                    node.status ===
                        'USED BY DIFFERENT ROSTER' ||
                    node.status ===
                        'UNUSED / UNRESOLVED'
                ) {
                    summary.unresolved++;
                }


                for (
                    const child
                    of node.children ||
                    []
                ) {
                    visit(
                        child
                    );
                }
            };


        for (
            const trade
            of trades
        ) {
            for (
                const participant
                of trade.participants
            ) {
                for (
                    const root
                    of participant
                        .receivedLineages
                ) {
                    visit(
                        root
                    );
                }
            }
        }


        summary.realizedPoints =
            roundPoints(
                summary.realizedPoints
            );


        summary.positionalValueUnits =
            roundValue(
                summary.positionalValueUnits
            );


        return summary;
    };


/*
    =====================================================
    IDENTITIES / TIME
    =====================================================
*/

const assetIdentity =
    asset => {

        if (
            asset.assetType ===
            'player'
        ) {
            return (
                `PLAYER:${asset.playerID}`
            );
        }


        if (
            asset.assetType ===
            'pick'
        ) {
            return (
                `PICK:${asset.key}`
            );
        }


        if (
            asset.assetType ===
            'budget'
        ) {
            return (
                `BUDGET:${asset.amount}`
            );
        }


        return 'UNKNOWN';
    };


const normalizeTimestamp =
    value => {

        const number =
            Number(
                value
            );


        if (
            !Number.isFinite(
                number
            ) ||
            number <= 0
        ) {
            return 0;
        }


        /*
            Sleeper timestamps are generally milliseconds.
            Convert seconds if necessary.
        */

        return number <
            100000000000
            ? number * 1000
            : number;
    };


const fallbackDraftTimestamp =
    season => {

        return new Date(
            Number(
                season
            ),
            4,
            1,
            12,
            0,
            0,
            0
        )
            .getTime();
    };


const isOldEnough =
    timestamp => {

        if (!timestamp) {
            return false;
        }


        const cutoff =
            new Date();


        cutoff.setFullYear(
            cutoff.getFullYear() -
            MIN_TRADE_AGE_YEARS
        );


        return (
            timestamp <=
            cutoff.getTime()
        );
    };


const getAgeYears =
    timestamp => {

        if (!timestamp) {
            return null;
        }


        const elapsed =
            Date.now() -
            timestamp;


        const years =
            elapsed /
            (
                365.2425 *
                24 *
                60 *
                60 *
                1000
            );


        return Math.round(
            years *
            100
        ) /
        100;
    };


const compareTransactionsAscending = (
    a,
    b
) => {

    return (
        normalizeTimestamp(
            a.status_updated
        ) -
        normalizeTimestamp(
            b.status_updated
        )
    );
};


const compareTradesDescending = (
    a,
    b
) => {

    return (
        b.timestamp -
        a.timestamp
    );
};
