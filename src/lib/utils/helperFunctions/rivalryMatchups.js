import { getLeagueData } from "./leagueData";
import { leagueID } from '$lib/utils/leagueInfo';
import { waitForAll } from './multiPromise';

import {
    getRosterIDFromManagerIDAndYear
} from '$lib/utils/helperFunctions/universalFunctions';

import {
    getLeagueTeamManagers
} from "./leagueTeamManagers";


/*
    =====================================================
    PUBLIC
    =====================================================
*/

export const getRivalryMatchups = async (
    userOneID,
    userTwoID
) => {
    if (
        !userOneID ||
        !userTwoID
    ) {
        return;
    }


    let curLeagueID =
        leagueID;


    const teamManagers =
        await getLeagueTeamManagers()
            .catch(err => {
                console.error(err);
            });


    if (!teamManagers) {
        return;
    }


    const rivalry = {
        regularSeason:
            createRivalryBucket(),

        playoffs:
            createRivalryBucket(),

        leagueContext:
            null
    };


    /*
        League-wide regular-season pairing index.

        We are already downloading every regular-season
        matchup for every archived season to build the
        selected rivalry.

        We can use those SAME responses to determine how
        frequently every manager pairing has met.
    */

    const leaguePairs = {};


    const sharedSeasons = [];
    const completedSharedSeasons = [];


    /*
        ===============================================
        WALK THE SLEEPER ARCHIVE
        ===============================================
    */

    while (
        curLeagueID &&
        curLeagueID != 0
    ) {
        const leagueData =
            await getLeagueData(
                curLeagueID
            )
                .catch(err => {
                    console.error(err);
                });


        if (!leagueData) {
            break;
        }


        const year =
            Number(
                leagueData.season
            );


        const rosterIDOne =
            getRosterIDFromManagerIDAndYear(
                teamManagers,
                userOneID,
                year
            );


        const rosterIDTwo =
            getRosterIDFromManagerIDAndYear(
                teamManagers,
                userTwoID,
                year
            );


        const bothActive =
            Boolean(
                rosterIDOne &&
                rosterIDTwo &&
                rosterIDOne !=
                    rosterIDTwo
            );


        if (bothActive) {
            sharedSeasons.push(
                year
            );
        }


        const playoffStartWeek =
            parseInt(
                leagueData
                    ?.settings
                    ?.playoff_week_start
            );


        /*
            If Sleeper somehow lacks the setting,
            skip this season cleanly.
        */

        if (
            !Number.isFinite(
                playoffStartWeek
            ) ||
            playoffStartWeek <= 1
        ) {
            curLeagueID =
                leagueData
                    .previous_league_id;

            continue;
        }


        /*
            ==========================================
            REGULAR SEASON
            ==========================================
        */

        const regularSeasonPromises =
            [];


        for (
            let week = 1;
            week < playoffStartWeek;
            week++
        ) {
            regularSeasonPromises.push(
                fetch(
                    `https://api.sleeper.app/v1/league/${curLeagueID}/matchups/${week}`,
                    {
                        compress:
                            true
                    }
                )
            );
        }


        const regularSeasonResponses =
            await waitForAll(
                ...regularSeasonPromises
            );


        const regularSeasonJSONPromises =
            [];


        for (
            const response
            of regularSeasonResponses
        ) {
            if (!response.ok) {
                throw new Error(
                    `Unable to retrieve ${year} rivalry matchup data.`
                );
            }


            regularSeasonJSONPromises.push(
                response.json()
            );
        }


        const regularSeasonData =
            await waitForAll(
                ...regularSeasonJSONPromises
            );


        /*
            Build league-wide pairing counts using these
            same matchup responses.
        */

        for (
            let i = 0;
            i <
                regularSeasonData.length;
            i++
        ) {
            indexLeagueWeek(
                leaguePairs,
                regularSeasonData[i],
                year,
                teamManagers
            );
        }


        /*
            Determine whether this season's entire regular
            season is complete.

            This matters for "meetings per shared season."

            We don't want an unplayed/current season to
            artificially lower rivalry frequency.
        */

        const regularSeasonComplete =
            isRegularSeasonComplete(
                regularSeasonData
            );


        if (
            bothActive &&
            regularSeasonComplete
        ) {
            completedSharedSeasons.push(
                year
            );
        }


        /*
            Selected rivalry regular-season games.
        */

        if (bothActive) {
            for (
                let i = 0;
                i <
                    regularSeasonData.length;
                i++
            ) {
                const week =
                    i + 1;


                const processed =
                    processRivalryMatchups(
                        regularSeasonData[i],
                        week,
                        rosterIDOne,
                        rosterIDTwo
                    );


                if (processed) {
                    addMatchup(
                        rivalry
                            .regularSeason,
                        processed.matchup,
                        year,
                        week,
                        null
                    );
                }
            }
        }


        /*
            ==========================================
            WINNERS-BRACKET PLAYOFFS ONLY
            ==========================================
        */

        if (bothActive) {
            const winnersBracketResponse =
                await fetch(
                    `https://api.sleeper.app/v1/league/${curLeagueID}/winners_bracket`,
                    {
                        compress:
                            true
                    }
                );


            let winnersBracket =
                [];


            if (
                winnersBracketResponse.ok
            ) {
                winnersBracket =
                    await winnersBracketResponse
                        .json();
            }


            if (
                Array.isArray(
                    winnersBracket
                ) &&
                winnersBracket.length
            ) {
                const rivalryPlayoffNodes =
                    winnersBracket.filter(
                        node => {
                            const teamOne =
                                parseInt(
                                    node.t1
                                );

                            const teamTwo =
                                parseInt(
                                    node.t2
                                );


                            return (
                                (
                                    teamOne ==
                                        parseInt(
                                            rosterIDOne
                                        ) &&
                                    teamTwo ==
                                        parseInt(
                                            rosterIDTwo
                                        )
                                ) ||
                                (
                                    teamOne ==
                                        parseInt(
                                            rosterIDTwo
                                        ) &&
                                    teamTwo ==
                                        parseInt(
                                            rosterIDOne
                                        )
                                )
                            );
                        }
                    );


                for (
                    const bracketNode
                    of rivalryPlayoffNodes
                ) {
                    const round =
                        parseInt(
                            bracketNode.r
                        );


                    if (!round) {
                        continue;
                    }


                    const week =
                        playoffStartWeek +
                        round -
                        1;


                    const matchupResponse =
                        await fetch(
                            `https://api.sleeper.app/v1/league/${curLeagueID}/matchups/${week}`,
                            {
                                compress:
                                    true
                            }
                        );


                    if (
                        !matchupResponse.ok
                    ) {
                        continue;
                    }


                    const matchupData =
                        await matchupResponse
                            .json();


                    const processed =
                        processRivalryMatchups(
                            matchupData,
                            week,
                            rosterIDOne,
                            rosterIDTwo
                        );


                    if (!processed) {
                        continue;
                    }


                    addMatchup(
                        rivalry.playoffs,
                        processed.matchup,
                        year,
                        week,
                        getPlayoffRoundLabel(
                            round,
                            winnersBracket
                        )
                    );
                }
            }
        }


        curLeagueID =
            leagueData
                .previous_league_id;
    }


    /*
        Newest games first for the UI.
    */

    sortMatchups(
        rivalry
            .regularSeason
            .matchups
    );


    sortMatchups(
        rivalry
            .playoffs
            .matchups
    );


    /*
        League-wide significance of this particular
        manager pairing.
    */

    rivalry.leagueContext =
        buildLeagueContext({
            leaguePairs,

            teamManagers,

            userOneID:
                String(userOneID),

            userTwoID:
                String(userTwoID),

            sharedSeasons,

            completedSharedSeasons,

            regularMeetings:
                rivalry
                    .regularSeason
                    .matchups
                    .length
        });


    return rivalry;
};


/*
    =====================================================
    RIVALRY BUCKET
    =====================================================
*/

const createRivalryBucket = () => {
    return {
        points: {
            one:
                0,

            two:
                0
        },

        wins: {
            one:
                0,

            two:
                0
        },

        ties:
            0,

        matchups:
            []
    };
};


/*
    =====================================================
    SCORE ONE SIDE
    =====================================================
*/

const getSidePoints = side => {
    if (
        !side ||
        !Array.isArray(
            side.points
        )
    ) {
        return 0;
    }


    return side.points.reduce(
        (
            total,
            value
        ) =>
            total +
            (
                Number(value) ||
                0
            ),
        0
    );
};


/*
    =====================================================
    RAW SLEEPER ENTRY SCORE
    =====================================================
*/

const getRawEntryPoints =
    entry => {

        if (
            !entry ||
            !Array.isArray(
                entry.starters_points
            )
        ) {
            return 0;
        }


        return entry
            .starters_points
            .reduce(
                (
                    total,
                    value
                ) =>
                    total +
                    (
                        Number(value) ||
                        0
                    ),
                0
            );
    };


/*
    =====================================================
    ADD ONE COMPLETED MATCHUP
    =====================================================
*/

const addMatchup = (
    bucket,
    matchup,
    year,
    week,
    label = null
) => {
    const sideA =
        matchup?.[0];

    const sideB =
        matchup?.[1];


    if (
        !sideA ||
        !sideB
    ) {
        return false;
    }


    const sideAPoints =
        getSidePoints(
            sideA
        );

    const sideBPoints =
        getSidePoints(
            sideB
        );


    /*
        0-0 = unplayed.
    */

    if (
        sideAPoints === 0 &&
        sideBPoints === 0
    ) {
        return false;
    }


    bucket.points.one +=
        sideAPoints;

    bucket.points.two +=
        sideBPoints;


    if (
        sideAPoints >
        sideBPoints
    ) {
        bucket.wins.one++;
    }
    else if (
        sideAPoints <
        sideBPoints
    ) {
        bucket.wins.two++;
    }
    else {
        bucket.ties++;
    }


    bucket.matchups.push({
        week,
        year,
        label,
        matchup
    });


    return true;
};


/*
    =====================================================
    PROCESS SELECTED RIVALRY WEEK
    =====================================================
*/

const processRivalryMatchups = (
    inputMatchups,
    week,
    rosterIDOne,
    rosterIDTwo
) => {
    if (
        !inputMatchups ||
        inputMatchups.length == 0
    ) {
        return false;
    }


    const matchups =
        {};


    for (
        const match
        of inputMatchups
    ) {
        if (
            match.roster_id ==
                rosterIDOne ||
            match.roster_id ==
                rosterIDTwo
        ) {
            if (
                !matchups[
                    match.matchup_id
                ]
            ) {
                matchups[
                    match.matchup_id
                ] = [];
            }


            matchups[
                match.matchup_id
            ].push({
                roster_id:
                    match.roster_id,

                starters:
                    match.starters,

                points:
                    Array.isArray(
                        match.starters_points
                    )
                        ? match
                            .starters_points
                        : []
            });
        }
    }


    const keys =
        Object.keys(
            matchups
        );


    if (
        keys.length != 1
    ) {
        return;
    }


    const matchup =
        matchups[
            keys[0]
        ];


    if (
        !matchup ||
        matchup.length != 2
    ) {
        return;
    }


    /*
        Keep Player One on the left.
    */

    if (
        matchup[0]
            .roster_id ==
        rosterIDTwo
    ) {
        const two =
            matchup.shift();

        matchup.push(
            two
        );
    }


    const sideOnePoints =
        getSidePoints(
            matchup[0]
        );

    const sideTwoPoints =
        getSidePoints(
            matchup[1]
        );


    if (
        sideOnePoints === 0 &&
        sideTwoPoints === 0
    ) {
        return;
    }


    return {
        matchup,
        week
    };
};


/*
    =====================================================
    LEAGUE-WIDE WEEK INDEX
    =====================================================

    Counts every completed regular-season manager pairing.

    If a roster has co-owners, every manager on one roster
    is paired against every manager on the opponent roster.
    A Set prevents accidental duplicate manager pairs
    within a single matchup.
    =====================================================
*/

const indexLeagueWeek = (
    leaguePairs,
    rawWeek,
    year,
    teamManagers
) => {
    if (
        !Array.isArray(
            rawWeek
        )
    ) {
        return;
    }


    const grouped =
        {};


    for (
        const entry
        of rawWeek
    ) {
        if (
            entry.matchup_id ===
                null ||
            entry.matchup_id ===
                undefined
        ) {
            continue;
        }


        if (
            !grouped[
                entry.matchup_id
            ]
        ) {
            grouped[
                entry.matchup_id
            ] = [];
        }


        grouped[
            entry.matchup_id
        ].push(
            entry
        );
    }


    for (
        const matchupID
        of Object.keys(
            grouped
        )
    ) {
        const entries =
            grouped[
                matchupID
            ];


        if (
            entries.length != 2
        ) {
            continue;
        }


        const scoreOne =
            getRawEntryPoints(
                entries[0]
            );

        const scoreTwo =
            getRawEntryPoints(
                entries[1]
            );


        /*
            Future/unplayed Sleeper shell.
        */

        if (
            scoreOne === 0 &&
            scoreTwo === 0
        ) {
            continue;
        }


        const managersOne =
            getManagersForRoster(
                teamManagers,
                year,
                entries[0]
                    .roster_id
            );


        const managersTwo =
            getManagersForRoster(
                teamManagers,
                year,
                entries[1]
                    .roster_id
            );


        if (
            !managersOne.length ||
            !managersTwo.length
        ) {
            continue;
        }


        const pairsThisGame =
            new Set();


        for (
            const managerOne
            of managersOne
        ) {
            for (
                const managerTwo
                of managersTwo
            ) {
                if (
                    managerOne ==
                    managerTwo
                ) {
                    continue;
                }


                const key =
                    makePairKey(
                        managerOne,
                        managerTwo
                    );


                if (
                    pairsThisGame.has(
                        key
                    )
                ) {
                    continue;
                }


                pairsThisGame.add(
                    key
                );


                if (
                    !leaguePairs[
                        key
                    ]
                ) {
                    const [
                        idOne,
                        idTwo
                    ] =
                        key.split(
                            '|'
                        );


                    leaguePairs[
                        key
                    ] = {
                        key,

                        managerOneID:
                            idOne,

                        managerTwoID:
                            idTwo,

                        meetings:
                            0,

                        firstYear:
                            year,

                        lastYear:
                            year,

                        seasons:
                            new Set()
                    };
                }


                const pair =
                    leaguePairs[
                        key
                    ];


                pair.meetings++;

                pair.firstYear =
                    Math.min(
                        pair.firstYear,
                        year
                    );

                pair.lastYear =
                    Math.max(
                        pair.lastYear,
                        year
                    );

                pair.seasons.add(
                    year
                );
            }
        }
    }
};


/*
    =====================================================
    IS REGULAR SEASON COMPLETE?
    =====================================================

    The last regular-season week must contain completed
    games rather than 0-0 future shells.
    =====================================================
*/

const isRegularSeasonComplete =
    regularSeasonData => {

        if (
            !Array.isArray(
                regularSeasonData
            ) ||
            !regularSeasonData.length
        ) {
            return false;
        }


        const finalWeek =
            regularSeasonData[
                regularSeasonData.length -
                1
            ];


        if (
            !Array.isArray(
                finalWeek
            ) ||
            !finalWeek.length
        ) {
            return false;
        }


        const grouped =
            {};


        for (
            const entry
            of finalWeek
        ) {
            if (
                entry.matchup_id ===
                    null ||
                entry.matchup_id ===
                    undefined
            ) {
                continue;
            }


            if (
                !grouped[
                    entry.matchup_id
                ]
            ) {
                grouped[
                    entry.matchup_id
                ] = [];
            }


            grouped[
                entry.matchup_id
            ].push(
                entry
            );
        }


        const games =
            Object.values(
                grouped
            )
                .filter(
                    entries =>
                        entries.length ===
                        2
                );


        if (!games.length) {
            return false;
        }


        return games.every(
            entries => {
                const one =
                    getRawEntryPoints(
                        entries[0]
                    );

                const two =
                    getRawEntryPoints(
                        entries[1]
                    );


                return !(
                    one === 0 &&
                    two === 0
                );
            }
        );
    };


/*
    =====================================================
    GET MANAGERS FOR ROSTER
    =====================================================
*/

const getManagersForRoster = (
    teamManagers,
    year,
    rosterID
) => {
    const managers =
        teamManagers
            ?.teamManagersMap
            ?.[year]
            ?.[rosterID]
            ?.managers;


    if (
        !Array.isArray(
            managers
        )
    ) {
        return [];
    }


    return managers
        .map(
            id =>
                String(id)
        )
        .filter(Boolean);
};


/*
    =====================================================
    PAIR KEY
    =====================================================
*/

const makePairKey = (
    managerOne,
    managerTwo
) => {
    return [
        String(
            managerOne
        ),
        String(
            managerTwo
        )
    ]
        .sort()
        .join(
            '|'
        );
};


/*
    =====================================================
    MANAGER NAME
    =====================================================
*/

const getManagerName = (
    teamManagers,
    id
) => {
    const user =
        teamManagers
            ?.users
            ?.[id];


    return (
        user?.display_name ||
        user?.user_name ||
        String(id)
    );
};


/*
    =====================================================
    RANK ONE PAIR
    =====================================================
*/

const getPairRank = (
    pairs,
    selectedMeetings
) => {
    return (
        1 +
        pairs.filter(
            pair =>
                pair.meetings >
                selectedMeetings
        ).length
    );
};


const getBottomPairRank = (
    pairs,
    selectedMeetings
) => {
    return (
        1 +
        pairs.filter(
            pair =>
                pair.meetings <
                selectedMeetings
        ).length
    );
};


/*
    =====================================================
    OPPONENT FREQUENCY RANK
    =====================================================
*/

const getOpponentRank = (
    pairs,
    managerID,
    opponentID
) => {
    const managerPairs =
        pairs.filter(
            pair =>
                pair.managerOneID ==
                    managerID ||
                pair.managerTwoID ==
                    managerID
        );


    const selected =
        managerPairs.find(
            pair =>
                (
                    pair.managerOneID ==
                        opponentID ||
                    pair.managerTwoID ==
                        opponentID
                )
        );


    if (!selected) {
        return null;
    }


    const rank =
        1 +
        managerPairs.filter(
            pair =>
                pair.meetings >
                selected.meetings
        ).length;


    const tieCount =
        managerPairs.filter(
            pair =>
                pair.meetings ===
                selected.meetings
        ).length;


    return {
        rank,

        tied:
            tieCount > 1,

        meetings:
            selected.meetings,

        opponentCount:
            managerPairs.length,

        isMostPlayedOpponent:
            rank === 1
    };
};


/*
    =====================================================
    FREQUENCY CLASS
    =====================================================
*/

const getFrequencyClass =
    average => {

        if (
            average ===
                null ||
            average ===
                undefined
        ) {
            return 'UNKNOWN';
        }


        if (
            average >= 1.5
        ) {
            return 'EXTREMELY_FREQUENT';
        }


        if (
            average >= 1
        ) {
            return 'FREQUENT';
        }


        if (
            average >= 0.6
        ) {
            return 'MODERATE';
        }


        return 'INFREQUENT';
    };


/*
    =====================================================
    BUILD LEAGUE CONTEXT
    =====================================================
*/

const buildLeagueContext = ({
    leaguePairs,
    teamManagers,
    userOneID,
    userTwoID,
    sharedSeasons,
    completedSharedSeasons,
    regularMeetings
}) => {
    const pairs =
        Object.values(
            leaguePairs
        );


    const selectedKey =
        makePairKey(
            userOneID,
            userTwoID
        );


    const selectedPair =
        leaguePairs[
            selectedKey
        ] ||
        null;


    const leagueRank =
        selectedPair
            ? getPairRank(
                pairs,
                selectedPair.meetings
            )
            : null;


    const bottomRank =
        selectedPair
            ? getBottomPairRank(
                pairs,
                selectedPair.meetings
            )
            : null;


    const currentSeason =
        Number(
            teamManagers
                ?.currentSeason
        );


    /*
        NEW means exactly:

        Their first-ever regular-season meeting occurred
        in the PREVIOUS season.

        Nothing else gets this label.
    */

    const firstMeetingYear =
        selectedPair
            ?.firstYear ??
        null;


    const isNew =
        Boolean(
            firstMeetingYear &&
            Number.isFinite(
                currentSeason
            ) &&
            firstMeetingYear ===
                currentSeason - 1
        );


    let sizeTier =
        'NORMAL';


    if (isNew) {
        sizeTier =
            'NEW';
    }
    else if (
        leagueRank !== null &&
        leagueRank <= 4
    ) {
        sizeTier =
            'BIG';
    }
    else if (
        bottomRank !== null &&
        bottomRank <= 4
    ) {
        sizeTier =
            'SMALL';
    }


    const completedCount =
        completedSharedSeasons.length;


    const meetingsPerSharedSeason =
        completedCount > 0
            ? Number(
                (
                    regularMeetings /
                    completedCount
                ).toFixed(
                    2
                )
            )
            : null;


    const managerOneOpponentRank =
        getOpponentRank(
            pairs,
            userOneID,
            userTwoID
        );


    const managerTwoOpponentRank =
        getOpponentRank(
            pairs,
            userTwoID,
            userOneID
        );


    return {
        sizeTier,

        isNew,

        currentSeason,

        regularSeasonMeetings:
            regularMeetings,

        leaguePairingCount:
            pairs.length,

        leagueMeetingRank:
            leagueRank,

        leagueBottomRank:
            bottomRank,

        topFourByMeetingCount:
            Boolean(
                leagueRank !== null &&
                leagueRank <= 4
            ),

        bottomFourByMeetingCount:
            Boolean(
                bottomRank !== null &&
                bottomRank <= 4
            ),

        firstRegularSeasonMeetingYear:
            firstMeetingYear,

        mostRecentRegularSeasonMeetingYear:
            selectedPair
                ?.lastYear ??
            null,

        sharedSeasons:
            [...sharedSeasons]
                .sort(
                    (a, b) =>
                        a - b
                ),

        sharedSeasonCount:
            sharedSeasons.length,

        completedSharedSeasons:
            [
                ...completedSharedSeasons
            ]
                .sort(
                    (a, b) =>
                        a - b
                ),

        completedSharedSeasonCount:
            completedCount,

        meetingsPerCompletedSharedSeason:
            meetingsPerSharedSeason,

        frequencyClass:
            getFrequencyClass(
                meetingsPerSharedSeason
            ),

        managerOne: {
            id:
                userOneID,

            name:
                getManagerName(
                    teamManagers,
                    userOneID
                ),

            opponentFrequency:
                managerOneOpponentRank
        },

        managerTwo: {
            id:
                userTwoID,

            name:
                getManagerName(
                    teamManagers,
                    userTwoID
                ),

            opponentFrequency:
                managerTwoOpponentRank
        }
    };
};


/*
    =====================================================
    PLAYOFF ROUND LABEL
    =====================================================
*/

const getPlayoffRoundLabel = (
    round,
    winnersBracket
) => {
    const rounds =
        winnersBracket
            .map(
                node =>
                    parseInt(
                        node.r
                    )
            )
            .filter(
                value =>
                    Number.isFinite(
                        value
                    )
            );


    if (!rounds.length) {
        return (
            `Playoff Round ${round}`
        );
    }


    const finalRound =
        Math.max(
            ...rounds
        );


    if (
        round ==
        finalRound
    ) {
        return "Championship";
    }


    if (
        round ==
        finalRound - 1
    ) {
        return "Semifinal";
    }


    if (
        round ==
        finalRound - 2
    ) {
        return "Quarterfinal";
    }


    return (
        `Playoff Round ${round}`
    );
};


/*
    =====================================================
    SORT NEWEST -> OLDEST
    =====================================================
*/

const sortMatchups =
    matchups => {

        matchups.sort(
            (a, b) => {
                const yearOrder =
                    b.year -
                    a.year;

                const weekOrder =
                    b.week -
                    a.week;


                return (
                    yearOrder ||
                    weekOrder
                );
            }
        );
    };
