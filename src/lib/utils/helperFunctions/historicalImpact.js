import {
    leagueID
} from '$lib/utils/leagueInfo';

import {
    getLeagueData
} from './leagueData';

import {
    getLeagueTeamManagers
} from './leagueTeamManagers';

import {
    waitForAll
} from './multiPromise';


/*
    =====================================================
    HISTORICALLY IMPACTFUL GAMES
    =====================================================

    Core Impact asks:

    Did this game sit at or near a meaningful change in
    the manager's competitive trajectory?

    Core Impact includes:

    - long-term historical trajectory
    - next/previous five games
    - next/previous ten games
    - same-season trajectory
    - streaks begun
    - streaks ended
    - championship-bracket significance

    LONG-TERM WINDOW

    BEFORE:
        - up to two seasons before the focal season
        - PLUS the beginning of the focal season when
          at least seven games occurred before this game

    AFTER:
        - up to three seasons after the focal season
        - PLUS the remainder of the focal season when
          at least eight games occurred after this game

    AFTER a game independently qualifies as impactful:

    - close games can receive up to +8
    - projection upsets can receive up to +4

    Projection differences below five points are treated
    as toss-ups, not true favorites/underdogs.
    =====================================================
*/


const TOP_COUNT =
    50;


const MIN_CORE_IMPACT =
    25;


/*
    88 core + 8 drama + 4 upset = 100.
*/

const MAX_CORE_SCORE =
    88;


const MAX_DRAMA_BONUS =
    8;


const MAX_UPSET_BONUS =
    4;


const PROJECTION_FAVORITE_THRESHOLD =
    5;


/*
    Same-season games needed before they become part of
    the LONG-TERM historical sample.

    User rule:

    - more than 6 already played = 7+
    - more than 7 remaining = 8+
*/

const MIN_CURRENT_SEASON_BEFORE =
    7;


const MIN_CURRENT_SEASON_AFTER =
    8;


const PROJECTION_QUERY =
    (
        'season_type=regular' +
        '&position[]=DB' +
        '&position[]=DEF' +
        '&position[]=DL' +
        '&position[]=FLEX' +
        '&position[]=IDP_FLEX' +
        '&position[]=K' +
        '&position[]=LB' +
        '&position[]=QB' +
        '&position[]=RB' +
        '&position[]=REC_FLEX' +
        '&position[]=SUPER_FLEX' +
        '&position[]=TE' +
        '&position[]=WR' +
        '&position[]=WRRB_FLEX' +
        '&order_by=ppr'
    );


let cachedImpactData =
    null;


let pendingImpactData =
    null;


/*
    Raw historical projection response cache.

    key:
        year|week
*/

const projectionCache =
    new Map();


/*
    =====================================================
    PUBLIC
    =====================================================
*/

export const getHistoricallyImpactfulGames =
    async (
        refresh = false
    ) => {

        if (
            cachedImpactData &&
            !refresh
        ) {
            return cachedImpactData;
        }


        if (
            pendingImpactData &&
            !refresh
        ) {
            return pendingImpactData;
        }


        if (refresh) {
            projectionCache.clear();
        }


        pendingImpactData =
            buildHistoricallyImpactfulGames();


        try {
            cachedImpactData =
                await pendingImpactData;


            return cachedImpactData;
        }
        finally {
            pendingImpactData =
                null;
        }
    };


/*
    =====================================================
    BUILD
    =====================================================
*/

const buildHistoricallyImpactfulGames =
    async () => {

        const teamManagers =
            await getLeagueTeamManagers();


        const games =
            await loadAllHistoricalGames(
                teamManagers
            );


        const managerGames =
            buildManagerGameHistories(
                games
            );


        const positiveCandidates =
            [];


        const negativeCandidates =
            [];


        for (
            const managerID
            of Object.keys(
                managerGames
            )
        ) {
            const history =
                managerGames[
                    managerID
                ];


            for (
                let i = 0;
                i < history.length;
                i++
            ) {
                const game =
                    history[i];


                if (
                    game.result ===
                    'W'
                ) {
                    const impact =
                        calculateImpact({
                            history,

                            index:
                                i,

                            direction:
                                'positive'
                        });


                    if (
                        impact &&
                        impact.coreScore >=
                            MIN_CORE_IMPACT
                    ) {
                        positiveCandidates.push(
                            createImpactEntry(
                                game,
                                impact,
                                'positive'
                            )
                        );
                    }
                }


                if (
                    game.result ===
                    'L'
                ) {
                    const impact =
                        calculateImpact({
                            history,

                            index:
                                i,

                            direction:
                                'negative'
                        });


                    if (
                        impact &&
                        impact.coreScore >=
                            MIN_CORE_IMPACT
                    ) {
                        negativeCandidates.push(
                            createImpactEntry(
                                game,
                                impact,
                                'negative'
                            )
                        );
                    }
                }
            }
        }


        /*
            Projection is deliberately evaluated AFTER
            Core Impact qualification.

            A random upset cannot create an Impact entry.
        */

        await applyProjectionBonuses(
            positiveCandidates,
            negativeCandidates
        );


        /*
            Highest magnitude first.
        */

        const positiveTop =
            positiveCandidates
                .sort(
                    compareImpactStrength
                )
                .slice(
                    0,
                    TOP_COUNT
                );


        const negativeTop =
            negativeCandidates
                .sort(
                    compareImpactStrength
                )
                .slice(
                    0,
                    TOP_COUNT
                );


        /*
            Remove private calculation-only payload before
            returning to the page.
        */

        positiveTop.forEach(
            cleanImpactEntry
        );


        negativeTop.forEach(
            cleanImpactEntry
        );


        return {
            positive:
                positiveTop,

            negative:
                negativeTop,

            diagnostics: {
                historicalGames:
                    games.length,

                managersAnalyzed:
                    Object.keys(
                        managerGames
                    ).length,

                positiveCandidates:
                    positiveCandidates.length,

                negativeCandidates:
                    negativeCandidates.length,

                minimumCoreImpact:
                    MIN_CORE_IMPACT
            }
        };
    };


/*
    =====================================================
    LOAD ALL HISTORICAL GAMES
    =====================================================
*/

const loadAllHistoricalGames =
    async teamManagers => {

        const games =
            [];


        const seenGameKeys =
            new Set();


        let currentLeagueID =
            leagueID;


        while (
            currentLeagueID &&
            currentLeagueID != 0
        ) {
            const leagueData =
                await getLeagueData(
                    currentLeagueID
                );


            if (!leagueData) {
                break;
            }


            const year =
                Number(
                    leagueData.season
                );


            const playoffStart =
                Number(
                    leagueData
                        ?.settings
                        ?.playoff_week_start
                );


            const scoringSettings =
                leagueData
                    ?.scoring_settings ||
                {};


            if (
                Number.isFinite(
                    playoffStart
                ) &&
                playoffStart > 1
            ) {
                const weekPromises =
                    [];


                for (
                    let week = 1;
                    week < playoffStart;
                    week++
                ) {
                    weekPromises.push(
                        fetch(
                            `https://api.sleeper.app/v1/league/${currentLeagueID}/matchups/${week}`,
                            {
                                compress:
                                    true
                            }
                        )
                    );
                }


                const responses =
                    await waitForAll(
                        ...weekPromises
                    );


                const jsonPromises =
                    [];


                for (
                    const response
                    of responses
                ) {
                    if (!response.ok) {
                        throw new Error(
                            `Unable to retrieve ${year} matchup history.`
                        );
                    }


                    jsonPromises.push(
                        response.json()
                    );
                }


                const weeks =
                    await waitForAll(
                        ...jsonPromises
                    );


                for (
                    let i = 0;
                    i < weeks.length;
                    i++
                ) {
                    const week =
                        i + 1;


                    const weekGames =
                        processRegularWeek({
                            rawWeek:
                                weeks[i],

                            year,

                            week,

                            teamManagers,

                            scoringSettings
                        });


                    for (
                        const game
                        of weekGames
                    ) {
                        addUniqueGame(
                            games,
                            seenGameKeys,
                            game
                        );
                    }
                }


                const playoffGames =
                    await loadWinnersBracketGames({
                        leagueID:
                            currentLeagueID,

                        leagueData,

                        year,

                        teamManagers,

                        scoringSettings
                    });


                for (
                    const game
                    of playoffGames
                ) {
                    addUniqueGame(
                        games,
                        seenGameKeys,
                        game
                    );
                }
            }


            currentLeagueID =
                leagueData
                    .previous_league_id;
        }


        /*
            Chronological order is necessary for all
            before/after calculations.
        */

        games.sort(
            compareChronological
        );


        return games;
    };


/*
    =====================================================
    REGULAR WEEK
    =====================================================
*/

const processRegularWeek = ({
    rawWeek,
    year,
    week,
    teamManagers,
    scoringSettings
}) => {
    if (
        !Array.isArray(
            rawWeek
        )
    ) {
        return [];
    }


    const grouped =
        groupSleeperMatchups(
            rawWeek
        );


    const games =
        [];


    for (
        const matchupID
        of Object.keys(
            grouped
        )
    ) {
        const sides =
            grouped[
                matchupID
            ];


        if (
            sides.length !==
            2
        ) {
            continue;
        }


        const game =
            createGame({
                sideOne:
                    sides[0],

                sideTwo:
                    sides[1],

                year,

                week,

                type:
                    'regular',

                playoffLabel:
                    null,

                teamManagers,

                scoringSettings
            });


        if (game) {
            games.push(
                game
            );
        }
    }


    return games;
};


/*
    =====================================================
    WINNERS BRACKET
    =====================================================
*/

const loadWinnersBracketGames =
    async ({
        leagueID,
        leagueData,
        year,
        teamManagers,
        scoringSettings
    }) => {

        const response =
            await fetch(
                `https://api.sleeper.app/v1/league/${leagueID}/winners_bracket`,
                {
                    compress:
                        true
                }
            );


        if (!response.ok) {
            return [];
        }


        const bracket =
            await response.json();


        if (
            !Array.isArray(
                bracket
            ) ||
            !bracket.length
        ) {
            return [];
        }


        const validNodes =
            bracket.filter(
                node =>
                    Number(
                        node.t1
                    ) &&
                    Number(
                        node.t2
                    ) &&
                    Number(
                        node.r
                    )
            );


        if (
            !validNodes.length
        ) {
            return [];
        }


        const rounds =
            [
                ...new Set(
                    validNodes.map(
                        node =>
                            Number(
                                node.r
                            )
                    )
                )
            ];


        const playoffStart =
            Number(
                leagueData
                    ?.settings
                    ?.playoff_week_start
            );


        const weekByRound =
            {};


        const fetchPromises =
            [];


        for (
            const round
            of rounds
        ) {
            const week =
                playoffStart +
                round -
                1;


            fetchPromises.push(
                fetch(
                    `https://api.sleeper.app/v1/league/${leagueID}/matchups/${week}`,
                    {
                        compress:
                            true
                    }
                )
                    .then(
                        async res => ({
                            round,

                            week,

                            ok:
                                res.ok,

                            data:
                                res.ok
                                    ? await res.json()
                                    : []
                        })
                    )
            );
        }


        const fetched =
            await waitForAll(
                ...fetchPromises
            );


        for (
            const item
            of fetched
        ) {
            if (
                item.ok
            ) {
                weekByRound[
                    item.round
                ] = {
                    week:
                        item.week,

                    raw:
                        item.data
                };
            }
        }


        const maxRound =
            Math.max(
                ...rounds
            );


        const games =
            [];


        for (
            const node
            of validNodes
        ) {
            const round =
                Number(
                    node.r
                );


            const weekData =
                weekByRound[
                    round
                ];


            if (!weekData) {
                continue;
            }


            const rosterOne =
                Number(
                    node.t1
                );


            const rosterTwo =
                Number(
                    node.t2
                );


            const sideOne =
                weekData.raw.find(
                    item =>
                        Number(
                            item.roster_id
                        ) ===
                        rosterOne
                );


            const sideTwo =
                weekData.raw.find(
                    item =>
                        Number(
                            item.roster_id
                        ) ===
                        rosterTwo
                );


            if (
                !sideOne ||
                !sideTwo
            ) {
                continue;
            }


            const game =
                createGame({
                    sideOne,

                    sideTwo,

                    year,

                    week:
                        weekData.week,

                    type:
                        'playoff',

                    playoffLabel:
                        getPlayoffLabel(
                            round,
                            maxRound
                        ),

                    teamManagers,

                    scoringSettings
                });


            if (game) {
                games.push(
                    game
                );
            }
        }


        return games;
    };


/*
    =====================================================
    GROUP SLEEPER MATCHUPS
    =====================================================
*/

const groupSleeperMatchups =
    rawWeek => {

        const grouped =
            {};


        for (
            const side
            of rawWeek
        ) {
            if (
                side.matchup_id ===
                    null ||
                side.matchup_id ===
                    undefined
            ) {
                continue;
            }


            if (
                !grouped[
                    side.matchup_id
                ]
            ) {
                grouped[
                    side.matchup_id
                ] = [];
            }


            grouped[
                side.matchup_id
            ].push(
                side
            );
        }


        return grouped;
    };


/*
    =====================================================
    CREATE GAME
    =====================================================
*/

const createGame = ({
    sideOne,
    sideTwo,
    year,
    week,
    type,
    playoffLabel,
    teamManagers,
    scoringSettings
}) => {
    const scoreOne =
        getSleeperPoints(
            sideOne
        );


    const scoreTwo =
        getSleeperPoints(
            sideTwo
        );


    /*
        Future/unplayed matchup.
    */

    if (
        scoreOne === 0 &&
        scoreTwo === 0
    ) {
        return null;
    }


    /*
        Ties have no winner/loser trajectory direction in
        this version.
    */

    if (
        scoreOne ===
        scoreTwo
    ) {
        return null;
    }


    const rosterOne =
        Number(
            sideOne.roster_id
        );


    const rosterTwo =
        Number(
            sideTwo.roster_id
        );


    const managersOne =
        getRosterManagers(
            teamManagers,
            year,
            rosterOne
        );


    const managersTwo =
        getRosterManagers(
            teamManagers,
            year,
            rosterTwo
        );


    if (
        !managersOne.length ||
        !managersTwo.length
    ) {
        return null;
    }


    const oneWon =
        scoreOne >
        scoreTwo;


    const winnerSide =
        oneWon
            ? sideOne
            : sideTwo;


    const loserSide =
        oneWon
            ? sideTwo
            : sideOne;


    const winnerManagers =
        oneWon
            ? managersOne
            : managersTwo;


    const loserManagers =
        oneWon
            ? managersTwo
            : managersOne;


    const winnerRosterID =
        oneWon
            ? rosterOne
            : rosterTwo;


    const loserRosterID =
        oneWon
            ? rosterTwo
            : rosterOne;


    const winnerScore =
        oneWon
            ? scoreOne
            : scoreTwo;


    const loserScore =
        oneWon
            ? scoreTwo
            : scoreOne;


    return {
        year,

        week,

        type,

        playoffLabel,

        winnerRosterID,

        loserRosterID,

        winnerManagerIDs:
            winnerManagers,

        loserManagerIDs:
            loserManagers,

        winnerName:
            renderManagerNames(
                teamManagers,
                winnerManagers
            ),

        loserName:
            renderManagerNames(
                teamManagers,
                loserManagers
            ),

        winnerScore:
            roundScore(
                winnerScore
            ),

        loserScore:
            roundScore(
                loserScore
            ),

        margin:
            roundScore(
                winnerScore -
                loserScore
            ),

        /*
            Retained only so an already-qualified Impact
            game can later be checked against historical
            pregame projections.
        */

        winnerStarters:
            getStarterIDs(
                winnerSide
            ),

        loserStarters:
            getStarterIDs(
                loserSide
            ),

        scoringSettings:
            scoringSettings ||
            {}
    };
};


/*
    =====================================================
    UNIQUE GAME
    =====================================================
*/

const addUniqueGame = (
    games,
    seen,
    game
) => {
    const rosters =
        [
            game.winnerRosterID,
            game.loserRosterID
        ]
            .sort(
                (a, b) =>
                    a - b
            )
            .join(
                '-'
            );


    const key =
        (
            `${game.year}|` +
            `${game.week}|` +
            `${game.type}|` +
            `${rosters}`
        );


    if (
        seen.has(
            key
        )
    ) {
        return;
    }


    seen.add(
        key
    );


    games.push(
        game
    );
};


/*
    =====================================================
    MANAGER HISTORIES
    =====================================================
*/

const buildManagerGameHistories =
    games => {

        const histories =
            {};


        for (
            const game
            of games
        ) {
            for (
                const managerID
                of game.winnerManagerIDs
            ) {
                addManagerGame(
                    histories,
                    managerID,
                    game,
                    'W',
                    game.loserName
                );
            }


            for (
                const managerID
                of game.loserManagerIDs
            ) {
                addManagerGame(
                    histories,
                    managerID,
                    game,
                    'L',
                    game.winnerName
                );
            }
        }


        for (
            const managerID
            of Object.keys(
                histories
            )
        ) {
            histories[
                managerID
            ].sort(
                compareChronological
            );
        }


        return histories;
    };


const addManagerGame = (
    histories,
    managerID,
    game,
    result,
    opponentName
) => {
    const id =
        String(
            managerID
        );


    if (
        !histories[
            id
        ]
    ) {
        histories[
            id
        ] = [];
    }


    const subjectWon =
        result ===
        'W';


    histories[
        id
    ].push({
        ...game,

        managerID:
            id,

        managerName:
            subjectWon
                ? game.winnerName
                : game.loserName,

        opponentName,

        result,

        pointsFor:
            subjectWon
                ? game.winnerScore
                : game.loserScore,

        pointsAgainst:
            subjectWon
                ? game.loserScore
                : game.winnerScore
    });
};


/*
    =====================================================
    CALCULATE CORE IMPACT
    =====================================================
*/

const calculateImpact = ({
    history,
    index,
    direction
}) => {
    const current =
        history[
            index
        ];


    let rawCore =
        0;


    const reasons =
        [];


    /*
        =================================================
        LONG-TERM HISTORICAL TRAJECTORY
        =================================================

        This window is centered on the GAME, not merely
        on the boundaries of the calendar/fantasy season.

        BEFORE includes:

        - previous two seasons
        - PLUS this season's earlier games when at least
          seven occurred before the focal game

        AFTER includes:

        - following three seasons
        - PLUS this season's later games when at least
          eight occurred after the focal game

        The focal game itself is never counted.
    */

    const longTermSignal =
        calculateLongTermSignal({
            history,

            index,

            current,

            direction
        });


    rawCore +=
        longTermSignal.score;


    if (
        longTermSignal.strong
    ) {
        reasons.push(
            buildLongTermReason(
                longTermSignal,
                direction
            )
        );
    }


    /*
        =================================================
        PREVIOUS/NEXT FIVE
        =================================================
    */

    const before5 =
        history.slice(
            Math.max(
                0,
                index - 5
            ),
            index
        );


    const after5 =
        history.slice(
            index + 1,
            index + 6
        );


    const shortSignal =
        calculateWindowSignal({
            before:
                before5,

            after:
                after5,

            target:
                5,

            direction,

            maxPoints:
                18
        });


    rawCore +=
        shortSignal.score;


    if (
        shortSignal.strong
    ) {
        reasons.push(
            buildWindowReason({
                signal:
                    shortSignal,

                direction,

                window:
                    5
            })
        );
    }


    /*
        =================================================
        PREVIOUS/NEXT TEN
        =================================================
    */

    const before10 =
        history.slice(
            Math.max(
                0,
                index - 10
            ),
            index
        );


    const after10 =
        history.slice(
            index + 1,
            index + 11
        );


    const mediumSignal =
        calculateWindowSignal({
            before:
                before10,

            after:
                after10,

            target:
                10,

            direction,

            maxPoints:
                12
        });


    rawCore +=
        mediumSignal.score;


    if (
        mediumSignal.strong
    ) {
        reasons.push(
            buildWindowReason({
                signal:
                    mediumSignal,

                direction,

                window:
                    10
            })
        );
    }


    /*
        =================================================
        SAME-SEASON TRAJECTORY
        =================================================
    */

    const seasonBefore =
        history.filter(
            (
                game,
                gameIndex
            ) =>
                game.year ===
                    current.year &&
                gameIndex <
                    index
        );


    const seasonAfter =
        history.filter(
            (
                game,
                gameIndex
            ) =>
                game.year ===
                    current.year &&
                gameIndex >
                    index
        );


    const seasonSignal =
        calculateWindowSignal({
            before:
                seasonBefore,

            after:
                seasonAfter,

            target:
                5,

            direction,

            maxPoints:
                8
        });


    rawCore +=
        seasonSignal.score;


    if (
        seasonSignal.strong &&
        !shortSignal.strong
    ) {
        reasons.push(
            direction ===
                'positive'
                ? (
                    'Results improved substantially over the remainder of that season.'
                )
                : (
                    'Results declined substantially over the remainder of that season.'
                )
        );
    }


    /*
        =================================================
        STREAK STARTED
        =================================================
    */

    const desiredResult =
        direction ===
            'positive'
            ? 'W'
            : 'L';


    const startedStreak =
        getForwardStreakLength(
            history,
            index,
            desiredResult
        );


    if (
        startedStreak >= 2
    ) {
        rawCore +=
            Math.min(
                10,
                (
                    startedStreak -
                    1
                ) *
                3
            );


        reasons.push(
            direction ===
                'positive'
                ? (
                    `Started a ${startedStreak}-game winning streak.`
                )
                : (
                    `Started a ${startedStreak}-game losing streak.`
                )
        );
    }


    /*
        =================================================
        OPPOSITE STREAK ENDED
        =================================================
    */

    const oppositeResult =
        direction ===
            'positive'
            ? 'L'
            : 'W';


    const endedStreak =
        getBackwardStreakLength(
            history,
            index - 1,
            oppositeResult
        );


    if (
        endedStreak >= 2
    ) {
        rawCore +=
            Math.min(
                7,
                endedStreak *
                2
            );


        reasons.push(
            direction ===
                'positive'
                ? (
                    `Ended a ${endedStreak}-game losing streak.`
                )
                : (
                    `Ended a ${endedStreak}-game winning streak.`
                )
        );
    }


    /*
        =================================================
        PLAYOFF SIGNIFICANCE
        =================================================
    */

    if (
        current.type ===
        'playoff'
    ) {
        let playoffBonus =
            3;


        if (
            current.playoffLabel ===
            'Semifinal'
        ) {
            playoffBonus =
                6;
        }


        if (
            current.playoffLabel ===
            'Championship'
        ) {
            playoffBonus =
                direction ===
                    'positive'
                    ? 10
                    : 8;
        }


        rawCore +=
            playoffBonus;


        if (
            current.playoffLabel
        ) {
            reasons.push(
                direction ===
                    'positive'
                    ? (
                        `The win came in the ${current.playoffLabel.toLowerCase()}.`
                    )
                    : (
                        `The loss came in the ${current.playoffLabel.toLowerCase()}.`
                    )
            );
        }
    }


    const coreScore =
        Math.min(
            MAX_CORE_SCORE,
            Math.round(
                rawCore
            )
        );


    /*
        =================================================
        CLOSE-GAME BONUS
        =================================================

        Only an already-impactful game gets this bonus.
    */

    const dramaBonus =
        coreScore >=
            MIN_CORE_IMPACT
            ? getDramaBonus(
                current.margin
            )
            : 0;


    if (
        dramaBonus > 0
    ) {
        reasons.push(
            (
                `The game itself was decided by only ` +
                `${formatPoints(current.margin)} points.`
            )
        );
    }


    return {
        coreScore,

        dramaBonus,

        /*
            Projection bonus is filled later because only
            qualifying games trigger historical projection
            API requests.
        */

        projectionBonus:
            0,

        finalScore:
            Math.min(
                100,
                coreScore +
                    dramaBonus
            ),

        reasons:
            selectReasons(
                reasons
            ),

        label:
            getImpactLabel({
                direction,

                startedStreak,

                endedStreak,

                current,

                longTermSignal,

                shortSignal,

                mediumSignal
            }),

        longTermSignal
    };
};


/*
    =====================================================
    LONG-TERM TRAJECTORY
    =====================================================
*/

const calculateLongTermSignal = ({
    history,
    index,
    current,
    direction
}) => {

    /*
        Full historical seasons around the focal season.
    */

    const priorSeasons =
        history.filter(
            (
                game,
                gameIndex
            ) =>
                gameIndex <
                    index &&
                game.year >=
                    current.year - 2 &&
                game.year <
                    current.year
        );


    const futureSeasons =
        history.filter(
            (
                game,
                gameIndex
            ) =>
                gameIndex >
                    index &&
                game.year >
                    current.year &&
                game.year <=
                    current.year + 3
        );


    /*
        Substantial pieces of the focal season.

        We deliberately do NOT include small fragments here.
        Those already contribute through the immediate
        five-game, ten-game, and same-season calculations.
    */

    const currentSeasonBefore =
        history.filter(
            (
                game,
                gameIndex
            ) =>
                gameIndex <
                    index &&
                game.year ===
                    current.year
        );


    const currentSeasonAfter =
        history.filter(
            (
                game,
                gameIndex
            ) =>
                gameIndex >
                    index &&
                game.year ===
                    current.year
        );


    const includeCurrentBefore =
        currentSeasonBefore.length >=
        MIN_CURRENT_SEASON_BEFORE;


    const includeCurrentAfter =
        currentSeasonAfter.length >=
        MIN_CURRENT_SEASON_AFTER;


    /*
        The actual long-term samples are now centered on
        the game itself.

        Example:

        BEFORE:
            2021
            2022
            2023 first 8 games

        GAME:
            2023 focal game

        AFTER:
            2023 final 8 games
            2024
            2025
            2026
    */

    const before =
        [
            ...priorSeasons,

            ...(
                includeCurrentBefore
                    ? currentSeasonBefore
                    : []
            )
        ];


    const after =
        [
            ...(
                includeCurrentAfter
                    ? currentSeasonAfter
                    : []
            ),

            ...futureSeasons
        ];


    /*
        Count only genuinely separate prior/future seasons
        here.

        The focal season's substantial fragment contributes
        additional evidence, but we do not pretend that a
        partial season is a full historical season.
    */

    const priorSeasonCount =
        uniqueSeasonCount(
            priorSeasons
        );


    const futureSeasonCount =
        uniqueSeasonCount(
            futureSeasons
        );


    const beforeRate =
        getWinRate(
            before
        );


    const afterRate =
        getWinRate(
            after
        );


    if (
        beforeRate ===
            null ||
        afterRate ===
            null ||
        before.length <
            4 ||
        after.length <
            4
    ) {
        return {
            score:
                0,

            strong:
                false,

            beforeWins:
                countWins(
                    before
                ),

            beforeGames:
                before.length,

            afterWins:
                countWins(
                    after
                ),

            afterGames:
                after.length,

            priorSeasonCount,

            futureSeasonCount,

            currentSeasonBeforeGames:
                includeCurrentBefore
                    ? currentSeasonBefore.length
                    : 0,

            currentSeasonAfterGames:
                includeCurrentAfter
                    ? currentSeasonAfter.length
                    : 0,

            includedCurrentBefore:
                includeCurrentBefore,

            includedCurrentAfter:
                includeCurrentAfter,

            difference:
                0
        };
    }


    const rawDifference =
        direction ===
            'positive'
            ? (
                afterRate -
                beforeRate
            )
            : (
                beforeRate -
                afterRate
            );


    const difference =
        Math.max(
            0,
            rawDifference
        );


    /*
        A .600 win-percentage swing is treated as roughly
        the practical maximum trajectory reversal.

        Example:

        .826 -> .238 = .588

        That receives nearly maximum change strength.
    */

    const changeStrength =
        Math.min(
            1,
            difference /
                0.6
        );


    /*
        Require meaningful game volume on BOTH sides.

        Twelve games on each side provides full game-level
        evidence.

        A substantial current-season segment helps reach
        that threshold naturally.
    */

    const gameEvidence =
        Math.min(
            1,
            Math.min(
                before.length,
                after.length
            ) /
                12
        );


    /*
        Historical persistence.

        A partial focal-season segment is meaningful, but
        it is not treated as a whole season.

        Give it one-half season of evidence.

        BEFORE full target:
            2 prior seasons

        AFTER full target:
            3 future seasons

        Examples:

        2 prior seasons alone:
            full before-season evidence

        1 prior season + 7+ focal-season games:
            1.5 / 2 evidence

        2 future seasons + 8+ focal-season games:
            2.5 / 3 evidence
    */

    const beforeSeasonUnits =
        priorSeasonCount +
        (
            includeCurrentBefore
                ? 0.5
                : 0
        );


    const afterSeasonUnits =
        futureSeasonCount +
        (
            includeCurrentAfter
                ? 0.5
                : 0
        );


    const beforePersistence =
        Math.min(
            1,
            beforeSeasonUnits /
                2
        );


    const afterPersistence =
        Math.min(
            1,
            afterSeasonUnits /
                3
        );


    const persistenceEvidence =
        Math.sqrt(
            beforePersistence *
            afterPersistence
        );


    /*
        The focal-season pieces also help make the location
        of the turning point more precise.

        If there is substantial evidence immediately on
        both sides of the game, give a modest confidence
        improvement.

        This does NOT increase the 35-point maximum.
    */

    let breakpointConfidence =
        1;


    if (
        includeCurrentBefore &&
        includeCurrentAfter
    ) {
        breakpointConfidence =
            1.08;
    }
    else if (
        includeCurrentBefore ||
        includeCurrentAfter
    ) {
        breakpointConfidence =
            1.04;
    }


    const score =
        Math.min(
            35,
            (
                35 *
                changeStrength *
                gameEvidence *
                persistenceEvidence *
                breakpointConfidence
            )
        );


    return {
        score,

        strong:
            score >=
                12,

        beforeWins:
            countWins(
                before
            ),

        beforeGames:
            before.length,

        afterWins:
            countWins(
                after
            ),

        afterGames:
            after.length,

        priorSeasonCount,

        futureSeasonCount,

        currentSeasonBeforeGames:
            includeCurrentBefore
                ? currentSeasonBefore.length
                : 0,

        currentSeasonAfterGames:
            includeCurrentAfter
                ? currentSeasonAfter.length
                : 0,

        includedCurrentBefore:
            includeCurrentBefore,

        includedCurrentAfter:
            includeCurrentAfter,

        beforeRate,

        afterRate,

        difference
    };
};


/*
    =====================================================
    LONG-TERM EXPLANATION
    =====================================================
*/

const buildLongTermReason = (
    signal,
    direction
) => {
    const beforeRecord =
        formatRecordFragment(
            signal.beforeWins,
            signal.beforeGames
        );


    const afterRecord =
        formatRecordFragment(
            signal.afterWins,
            signal.afterGames
        );


    /*
        Avoid describing these as simply "prior seasons"
        and "following seasons" because a substantial
        portion of the focal season may now be included.
    */

    if (
        direction ===
        'positive'
    ) {
        return (
            `Long-term trajectory improved from ${beforeRecord} ` +
            `across the broader period before this game to ` +
            `${afterRecord} across the broader period afterward.`
        );
    }


    return (
        `Long-term trajectory fell from ${beforeRecord} ` +
        `across the broader period before this game to ` +
        `${afterRecord} across the broader period afterward.`
    );
};


/*
    =====================================================
    ORDINARY BEFORE/AFTER WINDOW
    =====================================================
*/

const calculateWindowSignal = ({
    before,
    after,
    target,
    direction,
    maxPoints
}) => {
    const beforeRate =
        getWinRate(
            before
        );


    const afterRate =
        getWinRate(
            after
        );


    if (
        beforeRate ===
            null ||
        afterRate ===
            null
    ) {
        return {
            score:
                0,

            strong:
                false,

            beforeWins:
                0,

            beforeGames:
                before.length,

            afterWins:
                0,

            afterGames:
                after.length,

            difference:
                0
        };
    }


    const rawDifference =
        direction ===
            'positive'
            ? (
                afterRate -
                beforeRate
            )
            : (
                beforeRate -
                afterRate
            );


    const difference =
        Math.max(
            0,
            rawDifference
        );


    const evidence =
        Math.min(
            before.length,
            after.length
        );


    const confidence =
        Math.min(
            1,
            evidence /
            Math.max(
                3,
                target *
                    0.6
            )
        );


    const score =
        difference *
        confidence *
        maxPoints;


    return {
        score,

        strong:
            score >=
                maxPoints *
                0.3,

        beforeWins:
            countWins(
                before
            ),

        beforeGames:
            before.length,

        afterWins:
            countWins(
                after
            ),

        afterGames:
            after.length,

        beforeRate,

        afterRate,

        difference
    };
};


/*
    =====================================================
    WINDOW EXPLANATION
    =====================================================
*/

const buildWindowReason = ({
    signal,
    direction,
    window
}) => {
    const beforeText =
        formatRecordFragment(
            signal.beforeWins,
            signal.beforeGames
        );


    const afterText =
        formatRecordFragment(
            signal.afterWins,
            signal.afterGames
        );


    if (
        direction ===
        'positive'
    ) {
        return (
            `The surrounding ${window}-game trend improved from ` +
            `${beforeText} before the game to ${afterText} afterward.`
        );
    }


    return (
        `The surrounding ${window}-game trend fell from ` +
        `${beforeText} before the game to ${afterText} afterward.`
    );
};


/*
    =====================================================
    CLOSE-GAME BONUS
    =====================================================
*/

const getDramaBonus =
    margin => {

        const value =
            Number(
                margin
            );


        if (
            !Number.isFinite(
                value
            )
        ) {
            return 0;
        }


        if (
            value <= 1
        ) {
            return MAX_DRAMA_BONUS;
        }


        if (
            value <= 3
        ) {
            return 6;
        }


        if (
            value <= 7
        ) {
            return 4;
        }


        if (
            value <= 14
        ) {
            return 2;
        }


        if (
            value <= 25
        ) {
            return 1;
        }


        return 0;
    };


/*
    =====================================================
    HISTORICAL PROJECTION / UPSET BONUS
    =====================================================

    The normal matchup page calculates projections by
    summing each starter's Sleeper projection under the
    league's scoring settings.

    We do the same here.

    IMPORTANT:

    - projection gap < 5 = toss-up
    - favorite losing = upset
    - only already-qualified Impact games are checked
    - maximum adjustment = 4
    =====================================================
*/

const applyProjectionBonuses =
    async (
        positiveCandidates,
        negativeCandidates
    ) => {

        const allCandidates =
            [
                ...positiveCandidates,
                ...negativeCandidates
            ];


        const uniqueWeekKeys =
            [
                ...new Set(
                    allCandidates.map(
                        candidate =>
                            (
                                `${candidate.year}|` +
                                `${candidate.week}`
                            )
                    )
                )
            ];


        const projectionPromises =
            uniqueWeekKeys.map(
                async key => {

                    const [
                        year,
                        week
                    ] =
                        key
                            .split(
                                '|'
                            )
                            .map(
                                Number
                            );


                    const data =
                        await getHistoricalProjectionWeek(
                            year,
                            week
                        );


                    return {
                        key,
                        data
                    };
                }
            );


        const resolved =
            await Promise.all(
                projectionPromises
            );


        const weekMap =
            new Map();


        for (
            const item
            of resolved
        ) {
            weekMap.set(
                item.key,
                item.data
            );
        }


        for (
            const candidate
            of allCandidates
        ) {
            const key =
                (
                    `${candidate.year}|` +
                    `${candidate.week}`
                );


            const projectionRows =
                weekMap.get(
                    key
                );


            if (
                !Array.isArray(
                    projectionRows
                ) ||
                !projectionRows.length
            ) {
                continue;
            }


            const winnerProjection =
                calculateLineupProjection({
                    starterIDs:
                        candidate._winnerStarters,

                    projectionRows,

                    scoringSettings:
                        candidate._scoringSettings
                });


            const loserProjection =
                calculateLineupProjection({
                    starterIDs:
                        candidate._loserStarters,

                    projectionRows,

                    scoringSettings:
                        candidate._scoringSettings
                });


            if (
                winnerProjection <= 0 ||
                loserProjection <= 0
            ) {
                continue;
            }


            candidate.winnerProjection =
                roundScore(
                    winnerProjection
                );


            candidate.loserProjection =
                roundScore(
                    loserProjection
                );


            /*
                An upset occurred only if the actual LOSER
                was projected at least five points higher
                than the actual WINNER.
            */

            const projectedFavoriteGap =
                loserProjection -
                winnerProjection;


            candidate.projectedFavoriteGap =
                roundScore(
                    projectedFavoriteGap
                );


            if (
                projectedFavoriteGap <
                PROJECTION_FAVORITE_THRESHOLD
            ) {
                continue;
            }


            const projectionBonus =
                getUpsetBonus(
                    projectedFavoriteGap
                );


            if (
                projectionBonus <= 0
            ) {
                continue;
            }


            candidate.projectionBonus =
                projectionBonus;


            candidate.finalScore =
                Math.min(
                    100,
                    candidate.coreScore +
                        candidate.dramaBonus +
                        projectionBonus
                );


            /*
                Same upset has two legitimate historical
                perspectives:

                Positive:
                    underdog won.

                Negative:
                    favorite lost.
            */

            if (
                candidate.direction ===
                'positive'
            ) {
                candidate.reasons =
                    selectReasons([
                        ...candidate.reasons,

                        (
                            `Won despite being projected ` +
                            `${formatPoints(projectedFavoriteGap)} ` +
                            `points lower.`
                        )
                    ]);
            }
            else {
                candidate.reasons =
                    selectReasons([
                        ...candidate.reasons,

                        (
                            `Lost despite being projected ` +
                            `${formatPoints(projectedFavoriteGap)} ` +
                            `points higher.`
                        )
                    ]);
            }
        }
    };


/*
    =====================================================
    FETCH ONE HISTORICAL PROJECTION WEEK
    =====================================================
*/

const getHistoricalProjectionWeek =
    async (
        year,
        week
    ) => {

        const key =
            `${year}|${week}`;


        if (
            projectionCache.has(
                key
            )
        ) {
            return projectionCache.get(
                key
            );
        }


        try {
            const response =
                await fetch(
                    (
                        `https://api.sleeper.app/projections/nfl/` +
                        `${year}/${week}?${PROJECTION_QUERY}`
                    ),
                    {
                        compress:
                            true
                    }
                );


            if (!response.ok) {
                projectionCache.set(
                    key,
                    []
                );


                return [];
            }


            const data =
                await response.json();


            const result =
                Array.isArray(
                    data
                )
                    ? data
                    : [];


            projectionCache.set(
                key,
                result
            );


            return result;
        }
        catch {
            /*
                Historical projection availability should
                never break the Impact page.
            */

            projectionCache.set(
                key,
                []
            );


            return [];
        }
    };


/*
    =====================================================
    CALCULATE LINEUP PROJECTION
    =====================================================
*/

const calculateLineupProjection = ({
    starterIDs,
    projectionRows,
    scoringSettings
}) => {
    if (
        !Array.isArray(
            starterIDs
        ) ||
        !starterIDs.length
    ) {
        return 0;
    }


    const projectionMap =
        new Map();


    for (
        const row
        of projectionRows
    ) {
        const playerID =
            String(
                row?.player_id ||
                ''
            );


        if (!playerID) {
            continue;
        }


        projectionMap.set(
            playerID,
            calculatePlayerProjection(
                row?.stats,
                scoringSettings
            )
        );
    }


    let total =
        0;


    for (
        const starterID
        of starterIDs
    ) {
        total +=
            projectionMap.get(
                String(
                    starterID
                )
            ) ||
            0;
    }


    return roundScore(
        total
    );
};


/*
    Same method used by the site's existing projection
    endpoint.
*/

const calculatePlayerProjection = (
    projectedStats,
    scoringSettings
) => {
    if (
        !projectedStats ||
        !scoringSettings
    ) {
        return 0;
    }


    let score =
        0;


    for (
        const stat
        of Object.keys(
            projectedStats
        )
    ) {
        const multiplier =
            Number(
                scoringSettings[
                    stat
                ]
            ) ||
            0;


        score +=
            (
                Number(
                    projectedStats[
                        stat
                    ]
                ) ||
                0
            ) *
            multiplier;
    }


    return score;
};


/*
    =====================================================
    UPSET BONUS
    =====================================================
*/

const getUpsetBonus =
    projectedGap => {

        const gap =
            Number(
                projectedGap
            );


        if (
            !Number.isFinite(
                gap
            ) ||
            gap <
                PROJECTION_FAVORITE_THRESHOLD
        ) {
            return 0;
        }


        if (
            gap < 10
        ) {
            return 1;
        }


        if (
            gap < 15
        ) {
            return 2;
        }


        if (
            gap < 20
        ) {
            return 3;
        }


        return MAX_UPSET_BONUS;
    };


/*
    =====================================================
    IMPACT LABEL
    =====================================================
*/

const getImpactLabel = ({
    direction,
    startedStreak,
    endedStreak,
    current,
    longTermSignal,
    shortSignal,
    mediumSignal
}) => {
    if (
        current.playoffLabel ===
        'Championship'
    ) {
        return direction ===
            'positive'
            ? 'CHAMPIONSHIP BREAKTHROUGH'
            : 'CHAMPIONSHIP LOSS';
    }


    if (
        longTermSignal.strong &&
        longTermSignal.score >=
            22
    ) {
        return direction ===
            'positive'
            ? 'PROGRAM TURNING POINT'
            : 'PROGRAM COLLAPSE POINT';
    }


    if (
        direction ===
            'positive' &&
        startedStreak >= 4
    ) {
        return 'STREAK STARTER';
    }


    if (
        direction ===
            'negative' &&
        startedStreak >= 4
    ) {
        return 'COLLAPSE POINT';
    }


    if (
        endedStreak >= 4
    ) {
        return direction ===
            'positive'
            ? 'TURNING POINT'
            : 'MOMENTUM BREAK';
    }


    if (
        shortSignal.strong ||
        mediumSignal.strong
    ) {
        return direction ===
            'positive'
            ? 'TURNING POINT'
            : 'DOWNTURN';
    }


    return direction ===
        'positive'
        ? 'POSITIVE SWING'
        : 'NEGATIVE SWING';
};


/*
    =====================================================
    IMPACT ENTRY
    =====================================================
*/

const createImpactEntry = (
    game,
    impact,
    direction
) => {
    return {
        year:
            game.year,

        week:
            game.week,

        type:
            game.type,

        playoffLabel:
            game.playoffLabel,

        managerID:
            game.managerID,

        managerName:
            game.managerName,

        opponentName:
            game.opponentName,

        result:
            game.result,

        pointsFor:
            game.pointsFor,

        pointsAgainst:
            game.pointsAgainst,

        winnerName:
            game.winnerName,

        loserName:
            game.loserName,

        winnerScore:
            game.winnerScore,

        loserScore:
            game.loserScore,

        margin:
            game.margin,

        direction,

        coreScore:
            impact.coreScore,

        dramaBonus:
            impact.dramaBonus,

        projectionBonus:
            impact.projectionBonus,

        finalScore:
            impact.finalScore,

        label:
            impact.label,

        reasons:
            impact.reasons,

        /*
            Transparent long-term context for diagnostics
            or later UI expansion.
        */

        longTerm:
            impact.longTermSignal
                ?.strong
                ? {
                    beforeWins:
                        impact
                            .longTermSignal
                            .beforeWins,

                    beforeGames:
                        impact
                            .longTermSignal
                            .beforeGames,

                    afterWins:
                        impact
                            .longTermSignal
                            .afterWins,

                    afterGames:
                        impact
                            .longTermSignal
                            .afterGames,

                    priorSeasonCount:
                        impact
                            .longTermSignal
                            .priorSeasonCount,

                    futureSeasonCount:
                        impact
                            .longTermSignal
                            .futureSeasonCount,

                    currentSeasonBeforeGames:
                        impact
                            .longTermSignal
                            .currentSeasonBeforeGames,

                    currentSeasonAfterGames:
                        impact
                            .longTermSignal
                            .currentSeasonAfterGames,

                    includedCurrentBefore:
                        impact
                            .longTermSignal
                            .includedCurrentBefore,

                    includedCurrentAfter:
                        impact
                            .longTermSignal
                            .includedCurrentAfter
                }
                : null,

        /*
            Private projection-calculation fields.
        */

        _winnerStarters:
            game.winnerStarters,

        _loserStarters:
            game.loserStarters,

        _scoringSettings:
            game.scoringSettings
    };
};


/*
    =====================================================
    CLEAN PRIVATE FIELDS
    =====================================================
*/

const cleanImpactEntry =
    entry => {

        delete entry
            ._winnerStarters;


        delete entry
            ._loserStarters;


        delete entry
            ._scoringSettings;
    };


/*
    =====================================================
    STREAK HELPERS
    =====================================================
*/

const getForwardStreakLength = (
    history,
    startIndex,
    result
) => {
    let length =
        0;


    for (
        let i = startIndex;
        i < history.length;
        i++
    ) {
        if (
            history[i].result !==
            result
        ) {
            break;
        }


        length++;
    }


    return length;
};


const getBackwardStreakLength = (
    history,
    startIndex,
    result
) => {
    let length =
        0;


    for (
        let i = startIndex;
        i >= 0;
        i--
    ) {
        if (
            history[i].result !==
            result
        ) {
            break;
        }


        length++;
    }


    return length;
};


/*
    =====================================================
    RECORD HELPERS
    =====================================================
*/

const getWinRate =
    games => {

        if (
            !Array.isArray(
                games
            ) ||
            !games.length
        ) {
            return null;
        }


        return (
            countWins(
                games
            ) /
            games.length
        );
    };


const countWins =
    games => {

        return games.filter(
            game =>
                game.result ===
                'W'
        ).length;
    };


const uniqueSeasonCount =
    games => {

        return new Set(
            games.map(
                game =>
                    game.year
            )
        ).size;
    };


const formatRecordFragment = (
    wins,
    games
) => {
    if (!games) {
        return 'no games';
    }


    return (
        `${wins}-${games - wins}`
    );
};


/*
    =====================================================
    ROSTER -> MANAGERS
    =====================================================
*/

const getRosterManagers = (
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


const renderManagerNames = (
    teamManagers,
    managerIDs
) => {
    const names =
        managerIDs
            .map(
                id => {
                    const user =
                        teamManagers
                            ?.users
                            ?.[id];


                    return (
                        user?.display_name ||
                        user?.user_name ||
                        String(id)
                    );
                }
            )
            .filter(Boolean);


    return names.join(
        ' / '
    );
};


/*
    =====================================================
    STARTERS
    =====================================================
*/

const getStarterIDs =
    side => {

        if (
            !Array.isArray(
                side?.starters
            )
        ) {
            return [];
        }


        return side.starters
            .filter(
                starter =>
                    starter &&
                    starter != 0
            )
            .map(
                starter =>
                    String(
                        starter
                    )
            );
    };


/*
    =====================================================
    SLEEPER SCORE
    =====================================================
*/

const getSleeperPoints =
    side => {

        const direct =
            Number(
                side?.points
            );


        if (
            Number.isFinite(
                direct
            )
        ) {
            return direct;
        }


        if (
            Array.isArray(
                side?.starters_points
            )
        ) {
            return side
                .starters_points
                .reduce(
                    (
                        total,
                        value
                    ) =>
                        total +
                        (
                            Number(
                                value
                            ) ||
                            0
                        ),
                    0
                );
        }


        return 0;
    };


/*
    =====================================================
    PLAYOFF LABEL
    =====================================================
*/

const getPlayoffLabel = (
    round,
    finalRound
) => {
    if (
        round ===
        finalRound
    ) {
        return 'Championship';
    }


    if (
        round ===
        finalRound - 1
    ) {
        return 'Semifinal';
    }


    if (
        round ===
        finalRound - 2
    ) {
        return 'Quarterfinal';
    }


    return (
        `Playoff Round ${round}`
    );
};


/*
    =====================================================
    REASON SELECTION
    =====================================================
*/

const selectReasons =
    reasons => {

        const unique =
            [];


        const seen =
            new Set();


        for (
            const reason
            of reasons
        ) {
            if (!reason) {
                continue;
            }


            const normalized =
                reason
                    .toLowerCase()
                    .trim();


            if (
                seen.has(
                    normalized
                )
            ) {
                continue;
            }


            seen.add(
                normalized
            );


            unique.push(
                reason
            );
        }


        return unique.slice(
            0,
            5
        );
    };


/*
    =====================================================
    SORTING
    =====================================================
*/

const compareImpactStrength = (
    a,
    b
) => {
    return (
        b.finalScore -
            a.finalScore ||
        b.coreScore -
            a.coreScore ||
        b.projectionBonus -
            a.projectionBonus ||
        b.dramaBonus -
            a.dramaBonus ||
        a.margin -
            b.margin ||
        b.year -
            a.year ||
        b.week -
            a.week
    );
};


/*
    Internal chronological ordering only.
*/

const compareChronological = (
    a,
    b
) => {
    return (
        a.year -
            b.year ||
        a.week -
            b.week
    );
};


/*
    =====================================================
    FORMAT
    =====================================================
*/

const roundScore =
    value => {

        return Math.round(
            (
                Number(
                    value
                ) +
                Number.EPSILON
            ) *
            100
        ) /
        100;
    };


const formatPoints =
    value => {

        const rounded =
            roundScore(
                value
            );


        return Number.isInteger(
            rounded
        )
            ? String(
                rounded
            )
            : rounded.toFixed(
                2
            );
    };
