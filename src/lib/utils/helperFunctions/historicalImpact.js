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

    PURPOSE

    Identify wins and losses after which a manager's
    results materially changed.

    Positive Impact:
        a WIN followed by measurable improvement.

    Negative Impact:
        a LOSS followed by measurable decline.

    IMPORTANT

    Game closeness is NOT used to decide whether a game
    was historically impactful.

    First:
        calculate CORE historical impact.

    Then:
        if the game clears the impact threshold,
        add a small DRAMA BONUS for close games.
    =====================================================
*/


const TOP_COUNT =
    50;


/*
    A game must have meaningful trajectory evidence before
    any drama bonus is allowed.
*/

const MIN_CORE_IMPACT =
    25;


/*
    Prevent the core from consuming the entire 100-point
    range.

    The final eight points remain available for drama.
*/

const MAX_CORE_SCORE =
    92;


let cachedImpactData =
    null;

let pendingImpactData =
    null;


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


        /*
            Turn every actual game into one chronological
            entry for each participating manager.
        */

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
            Select the strongest 50 by FINAL score.
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
            But DISPLAY those selected games in
            chronological order.

            Oldest -> newest.
        */

        positiveTop.sort(
            compareChronological
        );

        negativeTop.sort(
            compareChronological
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
    LOAD ALL GAMES
    =====================================================

    Includes:

    - regular season
    - Sleeper winners/championship bracket

    Does NOT include consolation/lower-bracket games.
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

                            teamManagers
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


                /*
                    Championship bracket playoffs.
                */

                const playoffGames =
                    await loadWinnersBracketGames({
                        leagueID:
                            currentLeagueID,

                        leagueData,

                        year,

                        teamManagers
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
    teamManagers
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

                teamManagers
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
        teamManagers
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


            const label =
                getPlayoffLabel(
                    round,
                    maxRound
                );


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
                        label,

                    teamManagers
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
    teamManagers
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
        Future matchup shell.
    */

    if (
        scoreOne === 0 &&
        scoreTwo === 0
    ) {
        return null;
    }


    /*
        Ties are valid historical games, but there is no
        positive-win / negative-loss Impact direction.

        Keep them out of this first Impact implementation.
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
            )
    };
};


/*
    =====================================================
    UNIQUE GAMES
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
    CALCULATE IMPACT
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


    let rawCore =
        0;


    const reasons =
        [];


    /*
        =================================================
        SHORT-TERM TRAJECTORY
        =================================================
    */

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
                32
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
        EXTENDED TRAJECTORY
        =================================================
    */

    const longSignal =
        calculateWindowSignal({
            before:
                before10,

            after:
                after10,

            target:
                10,

            direction,

            maxPoints:
                20
        });


    rawCore +=
        longSignal.score;


    if (
        longSignal.strong
    ) {
        reasons.push(
            buildWindowReason({
                signal:
                    longSignal,

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
                15
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
        const streakPoints =
            Math.min(
                15,
                (
                    startedStreak -
                    1
                ) *
                4
            );


        rawCore +=
            streakPoints;


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
                10,
                endedStreak *
                2.5
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
        PLAYOFF LEVERAGE
        =================================================

        This does not create Impact by itself, but gives
        already meaningful trajectory games additional
        historical significance.
    */

    if (
        current.type ===
        'playoff'
    ) {
        let playoffBonus =
            4;


        if (
            current.playoffLabel ===
                'Semifinal'
        ) {
            playoffBonus =
                7;
        }


        if (
            current.playoffLabel ===
                'Championship'
        ) {
            playoffBonus =
                direction ===
                    'positive'
                    ? 12
                    : 10;
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
        DRAMA BONUS
        =================================================

        ONLY apply after the game has independently
        qualified as historically impactful.
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


    const finalScore =
        Math.min(
            100,
            coreScore +
            dramaBonus
        );


    return {
        coreScore,

        dramaBonus,

        finalScore,

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
                shortSignal,
                longSignal
            })
    };
};


/*
    =====================================================
    WINDOW SIGNAL
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


    /*
        Confidence prevents 1-game samples on either side
        from receiving full credit.
    */

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
                target * 0.6
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
    DRAMA
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
            return 8;
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
    IMPACT LABEL
    =====================================================
*/

const getImpactLabel = ({
    direction,
    startedStreak,
    endedStreak,
    current,
    shortSignal,
    longSignal
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
        longSignal.strong
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

        finalScore:
            impact.finalScore,

        label:
            impact.label,

        reasons:
            impact.reasons
    };
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


const formatRecordFragment = (
    wins,
    games
) => {
    if (!games) {
        return 'no games';
    }


    const losses =
        games -
        wins;


    return (
        `${wins}-${losses}`
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


        /*
            Quick explanation, not an essay.
        */

        return unique.slice(
            0,
            4
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
        a.margin -
            b.margin ||
        b.year -
            a.year ||
        b.week -
            a.week
    );
};


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
