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
        Every historical regular-season manager pairing.

        Later, rankings will be filtered down to pairings
        where BOTH managers are active in the CURRENT
        league season.
    */

    const leaguePairs =
        {};


    /*
        Selected rivalry history.

        sharedSeasons includes the current season if both
        managers are active.

        completedSharedSeasons does NOT include a current
        unfinished season.
    */

    const sharedSeasons =
        [];

    const completedSharedSeasons =
        [];

    const completedSharedSeasonsWithMeeting =
        [];


    /*
        Meetings used ONLY for the completed-season
        frequency calculation.

        An unfinished current season contributes nothing.
    */

    let completedSharedSeasonMeetings =
        0;


    /*
        =================================================
        WALK EVERY LINKED SLEEPER SEASON
        =================================================
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
            =================================================
            REGULAR SEASON
            =================================================
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
            Index every COMPLETED league matchup.

            This lets us rank current managers' historical
            pairings without making another Sleeper pass.
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
            An unfinished current season must NOT be used
            in frequency/cadence calculations.
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
            Selected rivalry.
        */

        if (bothActive) {
            let meetingsThisSeason =
                0;


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


                if (!processed) {
                    continue;
                }


                const added =
                    addMatchup(
                        rivalry
                            .regularSeason,
                        processed.matchup,
                        year,
                        week,
                        null
                    );


                if (added) {
                    meetingsThisSeason++;
                }
            }


            /*
                Only a fully completed regular season gets
                included in frequency/cadence calculations.
            */

            if (
                regularSeasonComplete
            ) {
                completedSharedSeasonMeetings +=
                    meetingsThisSeason;


                if (
                    meetingsThisSeason >
                    0
                ) {
                    completedSharedSeasonsWithMeeting.push(
                        year
                    );
                }
            }
        }


        /*
            =================================================
            WINNERS-BRACKET PLAYOFFS
            =================================================
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
        UI wants newest -> oldest.
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


    rivalry.leagueContext =
        buildLeagueContext({
            leaguePairs,

            teamManagers,

            userOneID:
                String(
                    userOneID
                ),

            userTwoID:
                String(
                    userTwoID
                ),

            sharedSeasons,

            completedSharedSeasons,

            completedSharedSeasonsWithMeeting,

            completedSharedSeasonMeetings,

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
    SCORE HELPERS
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
    ADD COMPLETED MATCHUP
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
        0-0 = future/unplayed.
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
    SELECTED RIVALRY WEEK
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
        Keep Player One on left.
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


    const one =
        getSidePoints(
            matchup[0]
        );

    const two =
        getSidePoints(
            matchup[1]
        );


    if (
        one === 0 &&
        two === 0
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
    INDEX ONE LEAGUE WEEK
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
                            year
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
            }
        }
    }
};


/*
    =====================================================
    CURRENT ACTIVE MANAGERS
    =====================================================

    Rankings are ONLY between managers who are members
    of the league in the CURRENT season.

    Retired/former managers remain part of historical
    head-to-head records but do NOT influence ranking.
    =====================================================
*/

const getCurrentActiveManagerIDs =
    teamManagers => {

        const active =
            new Set();


        const currentSeason =
            teamManagers
                ?.currentSeason;


        const currentRosters =
            teamManagers
                ?.teamManagersMap
                ?.[currentSeason];


        if (!currentRosters) {
            return active;
        }


        for (
            const rosterID
            of Object.keys(
                currentRosters
            )
        ) {
            const managers =
                currentRosters[
                    rosterID
                ]
                    ?.managers;


            if (
                !Array.isArray(
                    managers
                )
            ) {
                continue;
            }


            for (
                const managerID
                of managers
            ) {
                active.add(
                    String(
                        managerID
                    )
                );
            }
        }


        return active;
    };


/*
    =====================================================
    REGULAR SEASON COMPLETE?
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
    ROSTER MANAGERS
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
                String(
                    id
                )
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
    PAIR RANK
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
    OPPONENT RANK
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
                pair.managerOneID ==
                    opponentID ||
                pair.managerTwoID ==
                    opponentID
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

        isMostPlayedOpponent:
            rank === 1
    };
};


/*
    =====================================================
    FREQUENCY
    =====================================================

    This is RATE, calculated only from fully completed
    regular seasons shared by these managers.
    =====================================================
*/

const getFrequencyClass =
    average => {

        if (
            average === null ||
            average === undefined
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
    CADENCE
    =====================================================

    This answers a DIFFERENT question:

    Did these managers actually meet in the seasons they
    were both around?

    This prevents six scattered matchups from becoming
    "they meet every season."
    =====================================================
*/

const getCadenceClass = (
    completedSeasons,
    seasonsWithMeeting
) => {
    if (
        !completedSeasons
    ) {
        return 'UNKNOWN';
    }


    const missed =
        completedSeasons -
        seasonsWithMeeting;


    if (
        missed === 0
    ) {
        return 'EVERY_COMPLETED_SEASON';
    }


    if (
        missed === 1
    ) {
        return 'NEARLY_EVERY_SEASON';
    }


    const coverage =
        seasonsWithMeeting /
        completedSeasons;


    if (
        coverage >= 0.5
    ) {
        return 'INTERMITTENT';
    }


    return 'RARE';
};


/*
    =====================================================
    WORD DESCRIPTIONS
    =====================================================
*/

const getFrequencyDescription =
    frequencyClass => {

        switch (
            frequencyClass
        ) {
            case 'EXTREMELY_FREQUENT':
                return (
                    'These managers are unusually familiar opponents and cross paths substantially more often than a typical pairing.'
                );


            case 'FREQUENT':
                return (
                    'These managers have developed considerable regular-season familiarity.'
                );


            case 'MODERATE':
                return (
                    'These managers have a meaningful history together, but their meeting frequency is not unusually high.'
                );


            case 'INFREQUENT':
                return (
                    'These managers have crossed paths relatively infrequently.'
                );


            default:
                return (
                    'There is not enough completed shared-season history to characterize their frequency.'
                );
        }
    };


const getCadenceDescription =
    cadenceClass => {

        switch (
            cadenceClass
        ) {
            case 'EVERY_COMPLETED_SEASON':
                return (
                    'They have met in every completed season in which both managers were active.'
                );


            case 'NEARLY_EVERY_SEASON':
                return (
                    'They have met in nearly every completed season they shared, but not literally every one.'
                );


            case 'INTERMITTENT':
                return (
                    'Their meetings have been intermittent: they have missed each other in multiple completed seasons.'
                );


            case 'RARE':
                return (
                    'They have missed each other more often than they have met during completed seasons they shared.'
                );


            default:
                return (
                    'There is not enough completed history to describe their season-to-season cadence.'
                );
        }
    };


const getSizeDescription =
    sizeTier => {

        switch (
            sizeTier
        ) {
            case 'BIG':
                return (
                    'Among pairings between current league managers, this is one of the four most frequently played regular-season matchups.'
                );


            case 'SMALL':
                return (
                    'Among pairings between current league managers, this is one of the four least frequently played established regular-season matchups.'
                );


            case 'NEW':
                return (
                    'This rivalry is genuinely new: these managers first met in the regular season last year.'
                );


            case 'UNRANKED':
                return (
                    'This pairing is not part of the current-manager rivalry rankings.'
                );


            default:
                return (
                    'Among pairings between current league managers, this matchup falls between the most- and least-played groups.'
                );
        }
    };


const getOpponentRelationship = (
    managerName,
    opponentName,
    opponentFrequency
) => {
    if (!opponentFrequency) {
        return null;
    }


    if (
        opponentFrequency
            .isMostPlayedOpponent
    ) {
        return (
            `${opponentName} is one of ${managerName}'s most familiar regular-season opponents among current league managers.`
        );
    }


    if (
        opponentFrequency.rank <=
        3
    ) {
        return (
            `${opponentName} is among the current league opponents ${managerName} has faced most often.`
        );
    }


    return null;
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
    completedSharedSeasonsWithMeeting,
    completedSharedSeasonMeetings,
    regularMeetings
}) => {
    const allPairs =
        Object.values(
            leaguePairs
        );


    /*
        =================================================
        CRITICAL RANKING FILTER
        =================================================

        Only CURRENTLY ACTIVE managers count toward
        current league rivalry rankings.

        Historical games involving retired managers remain
        in rivalry history, but those pairings are removed
        from this ranking pool.
    */

    const activeManagerIDs =
        getCurrentActiveManagerIDs(
            teamManagers
        );


    const rankablePairs =
        allPairs.filter(
            pair =>
                activeManagerIDs.has(
                    String(
                        pair.managerOneID
                    )
                ) &&
                activeManagerIDs.has(
                    String(
                        pair.managerTwoID
                    )
                )
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


    const selectedManagersAreCurrent =
        activeManagerIDs.has(
            userOneID
        ) &&
        activeManagerIDs.has(
            userTwoID
        );


    const selectedRankablePair =
        selectedManagersAreCurrent
            ? rankablePairs.find(
                pair =>
                    pair.key ===
                    selectedKey
            )
            : null;


    const leagueRank =
        selectedRankablePair
            ? getPairRank(
                rankablePairs,
                selectedRankablePair
                    .meetings
            )
            : null;


    const bottomRank =
        selectedRankablePair
            ? getBottomPairRank(
                rankablePairs,
                selectedRankablePair
                    .meetings
            )
            : null;


    const currentSeason =
        Number(
            teamManagers
                ?.currentSeason
        );


    const firstMeetingYear =
        selectedPair
            ?.firstYear ??
        null;


    /*
        NEW has the exact definition requested:

        first-ever regular-season meeting = last season.
    */

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


    if (
        !selectedManagersAreCurrent
    ) {
        sizeTier =
            'UNRANKED';
    }
    else if (isNew) {
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


    /*
        Frequency.

        CURRENT unfinished season is not included.
    */

    const completedSeasonCount =
        completedSharedSeasons
            .length;


    const frequencyAverage =
        completedSeasonCount > 0
            ? (
                completedSharedSeasonMeetings /
                completedSeasonCount
            )
            : null;


    const frequencyClass =
        getFrequencyClass(
            frequencyAverage
        );


    /*
        Cadence.

        This explicitly records whether seasons were
        skipped.
    */

    const seasonsWithMeetingCount =
        completedSharedSeasonsWithMeeting
            .length;


    const cadenceClass =
        getCadenceClass(
            completedSeasonCount,
            seasonsWithMeetingCount
        );


    const managerOneOpponentRank =
        selectedManagersAreCurrent
            ? getOpponentRank(
                rankablePairs,
                userOneID,
                userTwoID
            )
            : null;


    const managerTwoOpponentRank =
        selectedManagersAreCurrent
            ? getOpponentRank(
                rankablePairs,
                userTwoID,
                userOneID
            )
            : null;


    const managerOneName =
        getManagerName(
            teamManagers,
            userOneID
        );


    const managerTwoName =
        getManagerName(
            teamManagers,
            userTwoID
        );


    return {
        /*
            THESE qualitative fields are what AI needs.
        */

        sizeTier,

        frequencyClass,

        cadenceClass,

        isNew,

        sizeDescription:
            getSizeDescription(
                sizeTier
            ),

        frequencyDescription:
            getFrequencyDescription(
                frequencyClass
            ),

        cadenceDescription:
            getCadenceDescription(
                cadenceClass
            ),

        managerOneRelationship:
            getOpponentRelationship(
                managerOneName,
                managerTwoName,
                managerOneOpponentRank
            ),

        managerTwoRelationship:
            getOpponentRelationship(
                managerTwoName,
                managerOneName,
                managerTwoOpponentRank
            ),


        /*
            INTERNAL / DEBUG INFORMATION.

            RivalryWriteup deliberately does NOT send these
            numbers to the AI.
        */

        currentSeason,

        selectedManagersAreCurrent,

        currentActiveManagerCount:
            activeManagerIDs.size,

        rankableCurrentManagerPairCount:
            rankablePairs.length,

        regularSeasonMeetings:
            regularMeetings,

        leagueMeetingRank:
            leagueRank,

        leagueBottomRank:
            bottomRank,

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

        completedSharedSeasons:
            [
                ...completedSharedSeasons
            ]
                .sort(
                    (a, b) =>
                        a - b
                ),

        completedSharedSeasonsWithMeeting:
            [
                ...completedSharedSeasonsWithMeeting
            ]
                .sort(
                    (a, b) =>
                        a - b
                ),

        completedSharedSeasonMeetings,

        managerOne: {
            id:
                userOneID,

            name:
                managerOneName,

            opponentFrequency:
                managerOneOpponentRank
        },

        managerTwo: {
            id:
                userTwoID,

            name:
                managerTwoName,

            opponentFrequency:
                managerTwoOpponentRank
        }
    };
};


/*
    =====================================================
    PLAYOFF LABEL
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
