import { leagueID } from '$lib/utils/leagueInfo';
import { getLeagueData } from './leagueData';
import { getLeagueTeamManagers } from './leagueTeamManagers';
import { waitForAll } from './multiPromise';


/*
    =====================================================
    HISTORICAL TRADE ANALYZER - PHASE 1
    =====================================================

    This file intentionally does NOT grade trades yet.

    Its job is to prove the historical source data and
    build the canonical raw ledger that the lineage engine
    will use later.

    VALIDATIONS

    1. Walk every linked Sleeper league season.
    2. Scan transaction rounds 0 through 18.
       - round 0 catches offseason / preseason movement.
    3. Deduplicate transactions by transaction_id.
    4. Record all completed trades, player moves, pick
       moves and official drops.
    5. Load every completed historical draft.
    6. Resolve a canonical traded pick identity:
           season + round + ORIGINAL roster
       into the player eventually selected.
    7. Inspect historical matchup payloads to determine
       whether players_points and starters_points exist.
    8. Mark trades eligible only after two full years.

    The next phase will consume this ledger and recursively
    follow each received asset until the branch reaches:
       - DROP
       - STILL HELD
       - TRADE -> new received assets
       - PICK USED -> selected player
       - PICK TRADED -> new received assets
    =====================================================
*/


const MIN_TRANSACTION_ROUND =
    0;


const MAX_TRANSACTION_ROUND =
    18;


const MIN_TRADE_AGE_YEARS =
    2;


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
            buildDiagnostics();


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
    async () => {

        const teamManagers =
            await getLeagueTeamManagers();


        const seasons =
            await getHistoricalLeagueChain();


        const seasonPackages =
            await Promise.all(
                seasons.map(
                    season =>
                        loadSeasonPackage(
                            season,
                            teamManagers
                        )
                )
            );


        const allTransactions =
            dedupeTransactions(
                seasonPackages.flatMap(
                    item =>
                        item.transactions
                )
            )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        Number(
                            a.status_updated
                        ) -
                        Number(
                            b.status_updated
                        )
                );


        const rawTrades =
            allTransactions.filter(
                transaction =>
                    transaction.type ===
                        'trade' &&
                    transaction.status !==
                        'failed'
            );


        const draftPickLookup =
            buildDraftPickLookup(
                seasonPackages.flatMap(
                    item =>
                        item.drafts
                )
            );


        const trades =
            rawTrades.map(
                transaction =>
                    digestTrade({
                        transaction,

                        teamManagers,

                        draftPickLookup
                    })
            );


        const eligibleTrades =
            trades.filter(
                trade =>
                    trade.eligible
            );


        return {
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
                    seasonPackages.reduce(
                        (
                            total,
                            season
                        ) =>
                            total +
                            season.drafts.length,
                        0
                    ),

                resolvedDraftPicks:
                    Object.keys(
                        draftPickLookup
                    ).length
            },

            validations:
                seasonPackages.map(
                    season =>
                        season.validation
                ),

            trades:
                trades
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            b.timestamp -
                            a.timestamp
                    ),

            eligibleTrades:
                eligibleTrades
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            b.timestamp -
                            a.timestamp
                    ),

            draftPickLookup
        };
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


            seasons.push({
                leagueID:
                    String(
                        currentLeagueID
                    ),

                year:
                    Number(
                        leagueData.season
                    ),

                playoffStart:
                    Number(
                        leagueData
                            ?.settings
                            ?.playoff_week_start
                    ) ||
                    null,

                draftID:
                    leagueData
                        ?.draft_id ||
                    null
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


/*
    =====================================================
    LOAD ONE SEASON
    =====================================================
*/

const loadSeasonPackage =
    async (
        season,
        teamManagers
    ) => {

        const [
            transactions,
            drafts,
            matchupValidation
        ] =
            await Promise.all([
                loadSeasonTransactions(
                    season
                ),

                loadSeasonDrafts(
                    season
                ),

                validateSeasonMatchupPayload(
                    season
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


        const playerMoves =
            transactions.reduce(
                (
                    total,
                    transaction
                ) =>
                    total +
                    Object.keys(
                        transaction.adds ||
                        {}
                    ).length,
                0
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

                playerMoves,

                officialDrops,

                draftPickMoves:
                    pickMoves,

                completedDrafts:
                    drafts.length,

                matchup:
                    matchupValidation
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


/*
    =====================================================
    WHAT COUNTS AS A TRUE DROP?
    =====================================================

    In a trade, a player usually appears in BOTH:
        drops[player] = sending roster
        adds[player]  = receiving roster

    That is a transfer, not a lineage-ending drop.

    A true drop exists only when the player appears in
    drops but NOT in adds.
    =====================================================
*/

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
                                picksResponse,
                                tradedResponse
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
                                    ),

                                    fetch(
                                        `https://api.sleeper.app/v1/draft/${draftID}/traded_picks`,
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
                                picks,
                                tradedPicks
                            ] =
                                await Promise.all([
                                    infoResponse.json(),

                                    picksResponse.json(),

                                    tradedResponse.ok
                                        ? tradedResponse.json()
                                        : Promise.resolve(
                                            []
                                        )
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

                                slotToRosterID:
                                    info
                                        .slot_to_roster_id ||
                                    {},

                                picks:
                                    Array.isArray(
                                        picks
                                    )
                                        ? picks
                                        : [],

                                tradedPicks:
                                    Array.isArray(
                                        tradedPicks
                                    )
                                        ? tradedPicks
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

    Canonical identity:
        SEASON | ROUND | ORIGINAL ROSTER

    We derive ORIGINAL ROSTER from the draft slot using
    slot_to_roster_id.

    This allows a pick to move through multiple trades
    without losing its identity.
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
    HISTORICAL MATCHUP PAYLOAD VALIDATION
    =====================================================

    We inspect Week 1 of each archived season. The goal is
    not to calculate production yet; it is to prove which
    per-player score fields Sleeper preserved.

    If Week 1 is empty, the validator also tries the final
    regular-season week.
    =====================================================
*/

const validateSeasonMatchupPayload =
    async season => {

        const candidateWeeks =
            [
                1
            ];


        if (
            Number.isFinite(
                season.playoffStart
            ) &&
            season.playoffStart >
                2
        ) {
            candidateWeeks.push(
                season.playoffStart -
                1
            );
        }


        for (
            const week
            of candidateWeeks
        ) {
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
                    continue;
                }


                const data =
                    await response.json();


                if (
                    !Array.isArray(
                        data
                    ) ||
                    !data.length
                ) {
                    continue;
                }


                const nonEmpty =
                    data.find(
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
                    data[0];


                return {
                    sampledWeek:
                        week,

                    rowCount:
                        data.length,

                    hasPlayers:
                        Array.isArray(
                            nonEmpty
                                ?.players
                        ),

                    hasStarters:
                        Array.isArray(
                            nonEmpty
                                ?.starters
                        ),

                    hasPlayersPoints:
                        Boolean(
                            nonEmpty &&
                            Object.prototype
                                .hasOwnProperty
                                .call(
                                    nonEmpty,
                                    'players_points'
                                )
                        ),

                    playersPointsType:
                        getValueType(
                            nonEmpty
                                ?.players_points
                        ),

                    hasStartersPoints:
                        Boolean(
                            nonEmpty &&
                            Object.prototype
                                .hasOwnProperty
                                .call(
                                    nonEmpty,
                                    'starters_points'
                                )
                        ),

                    startersPointsType:
                        getValueType(
                            nonEmpty
                                ?.starters_points
                        ),

                    sampleKeys:
                        nonEmpty
                            ? Object.keys(
                                nonEmpty
                            )
                                .sort()
                            : []
                };
            }
            catch {
                /*
                    Try the next candidate week.
                */
            }
        }


        return {
            sampledWeek:
                null,

            rowCount:
                0,

            hasPlayers:
                false,

            hasStarters:
                false,

            hasPlayersPoints:
                false,

            playersPointsType:
                'missing',

            hasStartersPoints:
                false,

            startersPointsType:
                'missing',

            sampleKeys:
                []
        };
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


/*
    =====================================================
    DIGEST ONE TRADE
    =====================================================
*/

const digestTrade = ({
    transaction,
    teamManagers,
    draftPickLookup
}) => {

    const timestamp =
        Number(
            transaction.status_updated
        ) ||
        0;


    const date =
        timestamp
            ? new Date(
                timestamp
            )
            : null;


    const season =
        Number(
            transaction
                ._sourceSeason
        ) ||
        (
            date
                ? date.getFullYear()
                : null
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
            rosterID =>
                digestTradeParticipant({
                    rosterID,

                    season,

                    transaction,

                    teamManagers,

                    draftPickLookup
                })
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
            date
                ? date.toISOString()
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
    DIGEST ONE PARTICIPANT
    =====================================================
*/

const digestTradeParticipant = ({
    rosterID,
    season,
    transaction,
    teamManagers,
    draftPickLookup
}) => {

    const adds =
        transaction.adds ||
        {};


    const drops =
        transaction.drops ||
        {};


    const receivedPlayers =
        [];


    const sentPlayers =
        [];


    for (
        const [
            playerID,
            receivingRosterID
        ]
        of Object.entries(
            adds
        )
    ) {
        if (
            Number(
                receivingRosterID
            ) ===
            rosterID
        ) {
            receivedPlayers.push(
                String(
                    playerID
                )
            );
        }
    }


    for (
        const [
            playerID,
            sendingRosterID
        ]
        of Object.entries(
            drops
        )
    ) {
        if (
            Number(
                sendingRosterID
            ) ===
            rosterID &&
            Object.prototype
                .hasOwnProperty
                .call(
                    adds,
                    playerID
                )
        ) {
            sentPlayers.push(
                String(
                    playerID
                )
            );
        }
    }


    const receivedPicks =
        [];


    const sentPicks =
        [];


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
        const canonical =
            digestPickMove(
                pick,
                draftPickLookup
            );


        if (
            Number(
                pick.owner_id
            ) ===
            rosterID
        ) {
            receivedPicks.push(
                canonical
            );
        }


        if (
            Number(
                pick.previous_owner_id
            ) ===
            rosterID
        ) {
            sentPicks.push(
                canonical
            );
        }
    }


    return {
        rosterID,

        team:
            getTeamIdentity(
                teamManagers,
                season,
                rosterID
            ),

        received: {
            players:
                receivedPlayers,

            picks:
                receivedPicks
        },

        sent: {
            players:
                sentPlayers,

            picks:
                sentPicks
        }
    };
};


/*
    =====================================================
    PICK MOVE
    =====================================================
*/

const digestPickMove = (
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
        key,

        season,

        round,

        originalRosterID,

        previousOwnerRosterID:
            Number(
                pick.previous_owner_id
            ) ||
            null,

        newOwnerRosterID:
            Number(
                pick.owner_id
            ) ||
            null,

        resolved:
            draftPickLookup[
                key
            ] ||
            null
    };
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


/*
    =====================================================
    AGE
    =====================================================
*/

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
