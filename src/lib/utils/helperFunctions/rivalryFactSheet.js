/*
    ============================================================
    USCCFFL RIVALRY HISTORICAL FACT ENGINE
    ============================================================

    Purpose:

    Do ALL arithmetic, chronology, streak detection, records,
    scoring analysis, and historical-state reconstruction here.

    The AI writer should receive VERIFIED FACTS and concentrate
    on prose.

    Important rule:

    0-0 = UNPLAYED.

    Such games are discarded everywhere in this file.
*/


/*
    ============================================================
    BASIC HELPERS
    ============================================================
*/

const round = (
    value,
    places = 2
) => {
    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {
        return 0;
    }

    return Number(
        number.toFixed(
            places
        )
    );
};


const scoreSide = side => {
    if (
        !side ||
        !Array.isArray(
            side.points
        )
    ) {
        return 0;
    }

    return round(
        side.points.reduce(
            (
                total,
                points
            ) =>
                total +
                (
                    Number(points) ||
                    0
                ),
            0
        )
    );
};


const gameLabel = game => {
    if (!game) {
        return null;
    }

    if (
        game.playoffRound
    ) {
        return (
            `${game.year} ` +
            `${game.playoffRound}`
        );
    }

    return (
        `${game.year} ` +
        `Week ${game.week}`
    );
};


const chronologicalSort =
    games =>
        [...games].sort(
            (a, b) =>
                (
                    a.year -
                    b.year
                ) ||
                (
                    a.week -
                    b.week
                )
        );


const newestFirst =
    games =>
        [...games].sort(
            (a, b) =>
                (
                    b.year -
                    a.year
                ) ||
                (
                    b.week -
                    a.week
                )
        );


const average = values => {
    if (
        !values?.length
    ) {
        return null;
    }

    return round(
        values.reduce(
            (
                total,
                value
            ) =>
                total +
                value,
            0
        ) /
        values.length
    );
};


const median = values => {
    if (
        !values?.length
    ) {
        return null;
    }

    const ordered =
        [...values].sort(
            (a, b) =>
                a - b
        );

    const middle =
        Math.floor(
            ordered.length /
            2
        );

    if (
        ordered.length % 2
    ) {
        return round(
            ordered[middle]
        );
    }

    return round(
        (
            ordered[
                middle - 1
            ] +
            ordered[
                middle
            ]
        ) /
        2
    );
};


/*
    ============================================================
    NORMALIZE MATCHUPS
    ============================================================
*/

const normalizeGames = (
    matchups,
    managerOneName,
    managerTwoName,
    type
) => {
    if (
        !Array.isArray(
            matchups
        )
    ) {
        return [];
    }

    return matchups
        .map(game => {
            const sideOne =
                game
                    ?.matchup
                    ?.[0];

            const sideTwo =
                game
                    ?.matchup
                    ?.[1];

            const scoreOne =
                scoreSide(
                    sideOne
                );

            const scoreTwo =
                scoreSide(
                    sideTwo
                );

            /*
                0-0 means unplayed.
            */
            if (
                scoreOne === 0 &&
                scoreTwo === 0
            ) {
                return null;
            }

            let winner = null;
            let loser = null;

            if (
                scoreOne >
                scoreTwo
            ) {
                winner =
                    managerOneName;

                loser =
                    managerTwoName;
            }
            else if (
                scoreTwo >
                scoreOne
            ) {
                winner =
                    managerTwoName;

                loser =
                    managerOneName;
            }

            return {
                type,

                year:
                    Number(
                        game.year
                    ),

                week:
                    Number(
                        game.week
                    ),

                playoffRound:
                    game.label ||
                    null,

                label:
                    gameLabel({
                        year:
                            Number(
                                game.year
                            ),

                        week:
                            Number(
                                game.week
                            ),

                        playoffRound:
                            game.label ||
                            null
                    }),

                managerOne:
                    managerOneName,

                managerTwo:
                    managerTwoName,

                managerOneScore:
                    scoreOne,

                managerTwoScore:
                    scoreTwo,

                winner,

                loser,

                tie:
                    scoreOne ===
                    scoreTwo,

                margin:
                    round(
                        Math.abs(
                            scoreOne -
                            scoreTwo
                        )
                    ),

                combinedScore:
                    round(
                        scoreOne +
                        scoreTwo
                    )
            };
        })
        .filter(Boolean);
};


/*
    ============================================================
    RECORD
    ============================================================
*/

const recordFromGames = (
    games,
    managerOneName,
    managerTwoName
) => {
    const record = {
        [managerOneName]:
            0,

        [managerTwoName]:
            0,

        ties:
            0,

        games:
            0
    };

    for (
        const game
        of games
    ) {
        record.games++;

        if (
            game.tie
        ) {
            record.ties++;
        }
        else if (
            game.winner ===
            managerOneName
        ) {
            record[
                managerOneName
            ]++;
        }
        else if (
            game.winner ===
            managerTwoName
        ) {
            record[
                managerTwoName
            ]++;
        }
    }

    return record;
};


const recordText = (
    record,
    managerOneName,
    managerTwoName
) => {
    if (!record) {
        return null;
    }

    const one =
        record[
            managerOneName
        ] || 0;

    const two =
        record[
            managerTwoName
        ] || 0;

    const ties =
        record.ties ||
        0;

    if (
        one === two
    ) {
        return (
            `Series tied ${one}-${two}` +
            (
                ties
                    ? ` with ${ties} tie${ties === 1 ? '' : 's'}`
                    : ''
            )
        );
    }

    const leader =
        one >
        two
            ? managerOneName
            : managerTwoName;

    const leaderWins =
        Math.max(
            one,
            two
        );

    const otherWins =
        Math.min(
            one,
            two
        );

    return (
        `${leader} leads ` +
        `${leaderWins}-${otherWins}` +
        (
            ties
                ? ` with ${ties} tie${ties === 1 ? '' : 's'}`
                : ''
        )
    );
};


/*
    ============================================================
    CHRONOLOGICAL SERIES LEDGER
    ============================================================

    This is especially important for preventing AI hallucinations.

    Every game explicitly records the series state immediately
    BEFORE and immediately AFTER that exact meeting.
*/

const buildLedger = (
    games,
    managerOneName,
    managerTwoName
) => {
    const ordered =
        chronologicalSort(
            games
        );

    const running = {
        [managerOneName]:
            0,

        [managerTwoName]:
            0,

        ties:
            0,

        games:
            0
    };

    return ordered.map(
        (
            game,
            index
        ) => {
            const before = {
                ...running
            };

            running.games++;

            if (
                game.tie
            ) {
                running.ties++;
            }
            else {
                running[
                    game.winner
                ]++;
            }

            const after = {
                ...running
            };

            return {
                meetingNumber:
                    index + 1,

                label:
                    game.label,

                year:
                    game.year,

                week:
                    game.week,

                playoffRound:
                    game.playoffRound,

                type:
                    game.type,

                winner:
                    game.winner,

                loser:
                    game.loser,

                tie:
                    game.tie,

                score:
                    `${game.managerOneScore}-${game.managerTwoScore}`,

                managerOneScore:
                    game.managerOneScore,

                managerTwoScore:
                    game.managerTwoScore,

                margin:
                    game.margin,

                seriesBefore:
                    recordText(
                        before,
                        managerOneName,
                        managerTwoName
                    ),

                seriesAfter:
                    recordText(
                        after,
                        managerOneName,
                        managerTwoName
                    ),

                recordBefore: {
                    ...before
                },

                recordAfter: {
                    ...after
                }
            };
        }
    );
};


/*
    ============================================================
    STREAKS
    ============================================================
*/

const buildWinningStreaks = (
    games,
    managerOneName,
    managerTwoName
) => {
    const ordered =
        chronologicalSort(
            games
        );

    const streaks = [];

    let active = null;

    for (
        const game
        of ordered
    ) {
        /*
            A tie breaks a winning streak.
        */
        if (
            game.tie
        ) {
            if (active) {
                streaks.push(
                    active
                );

                active = null;
            }

            continue;
        }

        if (
            !active ||
            active.manager !==
                game.winner
        ) {
            if (active) {
                streaks.push(
                    active
                );
            }

            active = {
                manager:
                    game.winner,

                length:
                    1,

                start:
                    game.label,

                end:
                    game.label,

                games: [
                    game.label
                ],

                firstGame: {
                    label:
                        game.label,

                    score:
                        `${game.managerOneScore}-${game.managerTwoScore}`
                },

                lastGame: {
                    label:
                        game.label,

                    score:
                        `${game.managerOneScore}-${game.managerTwoScore}`
                }
            };
        }
        else {
            active.length++;

            active.end =
                game.label;

            active.games.push(
                game.label
            );

            active.lastGame = {
                label:
                    game.label,

                score:
                    `${game.managerOneScore}-${game.managerTwoScore}`
            };
        }
    }

    if (active) {
        streaks.push(
            active
        );
    }

    const longestFor =
        manager => {
            const managerStreaks =
                streaks
                    .filter(
                        streak =>
                            streak.manager ===
                            manager
                    )
                    .sort(
                        (a, b) =>
                            b.length -
                            a.length
                    );

            return (
                managerStreaks[0] ||
                {
                    manager,
                    length:
                        0,
                    start:
                        null,
                    end:
                        null,
                    games:
                        []
                }
            );
        };

    return {
        all:
            streaks,

        longest: {
            [managerOneName]:
                longestFor(
                    managerOneName
                ),

            [managerTwoName]:
                longestFor(
                    managerTwoName
                )
        }
    };
};


/*
    ============================================================
    CURRENT STREAK + EXACT RECORD BEFORE STREAK
    ============================================================
*/

const buildCurrentStreak = (
    games,
    managerOneName,
    managerTwoName
) => {
    const ordered =
        newestFirst(
            games
        );

    if (
        !ordered.length
    ) {
        return null;
    }

    if (
        ordered[0].tie
    ) {
        return {
            type:
                'tie',

            statement:
                `The most recent meeting, ${ordered[0].label}, was a tie.`,

            game:
                ordered[0]
        };
    }

    const streakManager =
        ordered[0].winner;

    const streakGamesNewest = [];

    for (
        const game
        of ordered
    ) {
        if (
            game.tie ||
            game.winner !==
                streakManager
        ) {
            break;
        }

        streakGamesNewest.push(
            game
        );
    }

    const streakGames =
        chronologicalSort(
            streakGamesNewest
        );

    /*
        Remove the streak games from the complete chronology,
        then calculate the series record that existed immediately
        before the streak began.
    */

    const allChronological =
        chronologicalSort(
            games
        );

    const firstStreakGame =
        streakGames[0];

    const streakStartIndex =
        allChronological.findIndex(
            game =>
                game.year ===
                    firstStreakGame.year &&
                game.week ===
                    firstStreakGame.week &&
                game.type ===
                    firstStreakGame.type
        );

    const gamesBefore =
        streakStartIndex >= 0
            ? allChronological.slice(
                0,
                streakStartIndex
            )
            : [];

    const recordBefore =
        recordFromGames(
            gamesBefore,
            managerOneName,
            managerTwoName
        );

    const currentRecord =
        recordFromGames(
            games,
            managerOneName,
            managerTwoName
        );

    const startGame =
        streakGames[0];

    const endGame =
        streakGames[
            streakGames.length -
            1
        ];

    return {
        manager:
            streakManager,

        length:
            streakGames.length,

        began:
            startGame.label,

        mostRecent:
            endGame.label,

        firstWinInStreak: {
            label:
                startGame.label,

            score:
                `${startGame.managerOneScore}-${startGame.managerTwoScore}`,

            winner:
                startGame.winner
        },

        mostRecentWinInStreak: {
            label:
                endGame.label,

            score:
                `${endGame.managerOneScore}-${endGame.managerTwoScore}`,

            winner:
                endGame.winner
        },

        games:
            streakGames.map(
                game => ({
                    label:
                        game.label,

                    winner:
                        game.winner,

                    score:
                        `${game.managerOneScore}-${game.managerTwoScore}`
                })
            ),

        recordImmediatelyBeforeStreak:
            recordBefore,

        recordImmediatelyBeforeStreakText:
            recordText(
                recordBefore,
                managerOneName,
                managerTwoName
            ),

        currentRecord,

        currentRecordText:
            recordText(
                currentRecord,
                managerOneName,
                managerTwoName
            ),

        verifiedEffect:
            (
                `Immediately before this ${streakGames.length}-game winning streak, ` +
                `${recordText(recordBefore, managerOneName, managerTwoName)}. ` +
                `After the streak, ${recordText(currentRecord, managerOneName, managerTwoName)}.`
            )
    };
};


/*
    ============================================================
    GAME EXTREMES
    ============================================================
*/

const getGameExtremes = games => {
    if (
        !games.length
    ) {
        return {
            closest:
                null,

            biggestBlowout:
                null,

            highestCombinedScore:
                null,

            lowestCombinedScore:
                null
        };
    }

    const closest =
        [...games].sort(
            (a, b) =>
                a.margin -
                b.margin
        )[0];

    const biggest =
        [...games].sort(
            (a, b) =>
                b.margin -
                a.margin
        )[0];

    const highestCombined =
        [...games].sort(
            (a, b) =>
                b.combinedScore -
                a.combinedScore
        )[0];

    const lowestCombined =
        [...games].sort(
            (a, b) =>
                a.combinedScore -
                b.combinedScore
        )[0];

    const summarize =
        game =>
            game
                ? {
                    label:
                        game.label,

                    winner:
                        game.winner,

                    score:
                        `${game.managerOneScore}-${game.managerTwoScore}`,

                    managerOneScore:
                        game.managerOneScore,

                    managerTwoScore:
                        game.managerTwoScore,

                    margin:
                        game.margin,

                    combinedScore:
                        game.combinedScore
                }
                : null;

    return {
        closest:
            summarize(
                closest
            ),

        biggestBlowout:
            summarize(
                biggest
            ),

        highestCombinedScore:
            summarize(
                highestCombined
            ),

        lowestCombinedScore:
            summarize(
                lowestCombined
            )
    };
};


/*
    ============================================================
    INDIVIDUAL SCORE EXTREMES
    ============================================================
*/

const individualScoreStats = (
    games,
    managerName,
    scoreField
) => {
    if (
        !games.length
    ) {
        return null;
    }

    const performances =
        games.map(
            game => ({
                label:
                    game.label,

                score:
                    game[
                        scoreField
                    ]
            })
        );

    const highest =
        [...performances].sort(
            (a, b) =>
                b.score -
                a.score
        )[0];

    const lowest =
        [...performances].sort(
            (a, b) =>
                a.score -
                b.score
        )[0];

    return {
        manager:
            managerName,

        averageScore:
            average(
                performances.map(
                    item =>
                        item.score
                )
            ),

        highestScore:
            highest,

        lowestScore:
            lowest,

        gamesAtOrAbove150:
            performances.filter(
                item =>
                    item.score >=
                    150
            ).length,

        gamesAtOrAbove175:
            performances.filter(
                item =>
                    item.score >=
                    175
            ).length,

        gamesAtOrAbove200:
            performances.filter(
                item =>
                    item.score >=
                    200
            ).length,

        gamesBelow100:
            performances.filter(
                item =>
                    item.score <
                    100
            ).length
    };
};


/*
    ============================================================
    RECENT WINDOWS
    ============================================================
*/

const recentWindow = (
    games,
    count,
    managerOneName,
    managerTwoName
) => {
    const recent =
        newestFirst(
            games
        ).slice(
            0,
            count
        );

    if (
        !recent.length
    ) {
        return null;
    }

    const record =
        recordFromGames(
            recent,
            managerOneName,
            managerTwoName
        );

    return {
        requestedGames:
            count,

        actualGames:
            recent.length,

        record,

        recordText:
            recordText(
                record,
                managerOneName,
                managerTwoName
            ),

        meetings:
            recent.map(
                game => ({
                    label:
                        game.label,

                    winner:
                        game.winner,

                    score:
                        `${game.managerOneScore}-${game.managerTwoScore}`
                })
            )
    };
};


/*
    ============================================================
    SEASON-BY-SEASON HISTORY
    ============================================================
*/

const buildSeasonHistory = (
    games,
    managerOneName,
    managerTwoName
) => {
    const years = {};

    for (
        const game
        of chronologicalSort(
            games
        )
    ) {
        if (
            !years[
                game.year
            ]
        ) {
            years[
                game.year
            ] = [];
        }

        years[
            game.year
        ].push(
            game
        );
    }

    return Object
        .keys(
            years
        )
        .sort(
            (a, b) =>
                Number(a) -
                Number(b)
        )
        .map(year => {
            const yearGames =
                years[
                    year
                ];

            const record =
                recordFromGames(
                    yearGames,
                    managerOneName,
                    managerTwoName
                );

            const oneWins =
                record[
                    managerOneName
                ];

            const twoWins =
                record[
                    managerTwoName
                ];

            let result =
                'split';

            if (
                record.ties ===
                    yearGames.length
            ) {
                result =
                    'all ties';
            }
            else if (
                oneWins >
                    0 &&
                twoWins ===
                    0 &&
                record.ties ===
                    0
            ) {
                result =
                    `${managerOneName} sweep`;
            }
            else if (
                twoWins >
                    0 &&
                oneWins ===
                    0 &&
                record.ties ===
                    0
            ) {
                result =
                    `${managerTwoName} sweep`;
            }

            return {
                year:
                    Number(year),

                meetings:
                    yearGames.length,

                record,

                recordText:
                    recordText(
                        record,
                        managerOneName,
                        managerTwoName
                    ),

                result,

                games:
                    yearGames.map(
                        game => ({
                            label:
                                game.label,

                            type:
                                game.type,

                            winner:
                                game.winner,

                            score:
                                `${game.managerOneScore}-${game.managerTwoScore}`
                        })
                    )
            };
        });
};


/*
    ============================================================
    SERIES LEAD HISTORY
    ============================================================
*/

const buildLeadHistory = (
    ledger,
    managerOneName,
    managerTwoName
) => {
    const events = [];

    let priorLeader =
        null;

    for (
        const entry
        of ledger
    ) {
        const one =
            entry
                .recordAfter[
                    managerOneName
                ];

        const two =
            entry
                .recordAfter[
                    managerTwoName
                ];

        const currentLeader =
            one === two
                ? 'TIED'
                : (
                    one >
                    two
                        ? managerOneName
                        : managerTwoName
                );

        if (
            currentLeader !==
            priorLeader
        ) {
            events.push({
                afterMeeting:
                    entry.label,

                leader:
                    currentLeader,

                record:
                    entry.seriesAfter
            });

            priorLeader =
                currentLeader;
        }
    }

    return events;
};


/*
    ============================================================
    MAXIMUM SERIES LEAD
    ============================================================
*/

const maximumSeriesLead = (
    ledger,
    managerOneName,
    managerTwoName
) => {
    let best = null;

    for (
        const entry
        of ledger
    ) {
        const one =
            entry
                .recordAfter[
                    managerOneName
                ];

        const two =
            entry
                .recordAfter[
                    managerTwoName
                ];

        const difference =
            Math.abs(
                one -
                two
            );

        if (
            !best ||
            difference >
                best.leadSize
        ) {
            best = {
                afterMeeting:
                    entry.label,

                leader:
                    one === two
                        ? 'TIED'
                        : (
                            one >
                            two
                                ? managerOneName
                                : managerTwoName
                        ),

                leadSize:
                    difference,

                record:
                    entry.seriesAfter
            };
        }
    }

    return best;
};


/*
    ============================================================
    CAREER PERFORMANCE
    ============================================================
*/

const performanceSummary = record => {
    if (!record) {
        return null;
    }

    const wins =
        Number(
            record.wins ||
            0
        );

    const losses =
        Number(
            record.losses ||
            0
        );

    const ties =
        Number(
            record.ties ||
            0
        );

    const games =
        wins +
        losses +
        ties;

    return {
        wins,
        losses,
        ties,
        games,

        winPercentage:
            games
                ? round(
                    (
                        wins /
                        games
                    ) *
                    100,
                    1
                )
                : null,

        fantasyPointsFor:
            round(
                record.fptsFor ||
                0
            ),

        fantasyPointsAgainst:
            round(
                record.fptsAgainst ||
                0
            ),

        fantasyPointsPerGame:
            games
                ? round(
                    (
                        record.fptsFor ||
                        0
                    ) /
                    games
                )
                : null
    };
};


/*
    ============================================================
    PUBLIC FACT-SHEET BUILDER
    ============================================================
*/

export const buildRivalryFactSheet = ({
    rivalry,
    managerOneName,
    managerTwoName,
    tradeHistory = [],
    playerOneRecords = null,
    playerTwoRecords = null
}) => {
    const regularGames =
        normalizeGames(
            rivalry
                ?.regularSeason
                ?.matchups,
            managerOneName,
            managerTwoName,
            'regular-season'
        );

    const playoffGames =
        normalizeGames(
            rivalry
                ?.playoffs
                ?.matchups,
            managerOneName,
            managerTwoName,
            'playoff'
        );

    const allGames =
        [
            ...regularGames,
            ...playoffGames
        ];

    const regularChronological =
        chronologicalSort(
            regularGames
        );

    const playoffChronological =
        chronologicalSort(
            playoffGames
        );

    const allChronological =
        chronologicalSort(
            allGames
        );


    /*
        Records
    */

    const regularRecord =
        recordFromGames(
            regularGames,
            managerOneName,
            managerTwoName
        );

    const playoffRecord =
        recordFromGames(
            playoffGames,
            managerOneName,
            managerTwoName
        );

    const combinedRecord =
        recordFromGames(
            allGames,
            managerOneName,
            managerTwoName
        );


    /*
        Ledgers
    */

    const regularLedger =
        buildLedger(
            regularGames,
            managerOneName,
            managerTwoName
        );

    const playoffLedger =
        buildLedger(
            playoffGames,
            managerOneName,
            managerTwoName
        );

    const combinedLedger =
        buildLedger(
            allGames,
            managerOneName,
            managerTwoName
        );


    /*
        Streaks
    */

    const regularStreaks =
        buildWinningStreaks(
            regularGames,
            managerOneName,
            managerTwoName
        );

    const playoffStreaks =
        buildWinningStreaks(
            playoffGames,
            managerOneName,
            managerTwoName
        );

    const currentRegularStreak =
        buildCurrentStreak(
            regularGames,
            managerOneName,
            managerTwoName
        );

    const currentPlayoffStreak =
        buildCurrentStreak(
            playoffGames,
            managerOneName,
            managerTwoName
        );


    /*
        Scoring
    */

    const regularExtremes =
        getGameExtremes(
            regularGames
        );

    const playoffExtremes =
        getGameExtremes(
            playoffGames
        );

    const overallExtremes =
        getGameExtremes(
            allGames
        );


    /*
        Dates
    */

    const firstRegular =
        regularChronological[0] ||
        null;

    const mostRecentRegular =
        regularChronological[
            regularChronological.length -
            1
        ] ||
        null;

    const firstPlayoff =
        playoffChronological[0] ||
        null;

    const mostRecentPlayoff =
        playoffChronological[
            playoffChronological.length -
            1
        ] ||
        null;

    const firstOverall =
        allChronological[0] ||
        null;

    const mostRecentOverall =
        allChronological[
            allChronological.length -
            1
        ] ||
        null;


    return {
        /*
            Tell the writer explicitly what this object is.
        */
        instructionsForWriter: {
            authority:
                'Everything in this fact sheet has already been calculated by application code.',

            chronology:
                'Never reconstruct a historical record yourself. Use ledger seriesBefore and seriesAfter when discussing what the record was at any point in history.',

            sequence:
                'Two adjacent entries in a list are NOT necessarily consecutive NFL weeks. Never say next week, following week, back-to-back weeks, one week later, or consecutive weeks unless an explicit fact states that.',

            zeroZero:
                '0-0 games are unplayed and have already been excluded.',

            playoffDefinition:
                'Playoff games include championship/winners-bracket games only. Consolation games are excluded.'
        },


        managers: {
            managerOne:
                managerOneName,

            managerTwo:
                managerTwoName
        },


        meetingCounts: {
            regularSeason:
                regularGames.length,

            playoffs:
                playoffGames.length,

            total:
                allGames.length
        },


        currentRecords: {
            regularSeason: {
                record:
                    regularRecord,

                statement:
                    recordText(
                        regularRecord,
                        managerOneName,
                        managerTwoName
                    )
            },

            playoffs: {
                record:
                    playoffRecord,

                statement:
                    recordText(
                        playoffRecord,
                        managerOneName,
                        managerTwoName
                    )
            },

            combined: {
                record:
                    combinedRecord,

                statement:
                    recordText(
                        combinedRecord,
                        managerOneName,
                        managerTwoName
                    )
            }
        },


        firstAndMostRecent: {
            firstRegularSeasonMeeting:
                firstRegular
                    ? {
                        label:
                            firstRegular.label,

                        winner:
                            firstRegular.winner,

                        score:
                            `${firstRegular.managerOneScore}-${firstRegular.managerTwoScore}`
                    }
                    : null,

            mostRecentRegularSeasonMeeting:
                mostRecentRegular
                    ? {
                        label:
                            mostRecentRegular.label,

                        winner:
                            mostRecentRegular.winner,

                        score:
                            `${mostRecentRegular.managerOneScore}-${mostRecentRegular.managerTwoScore}`
                    }
                    : null,

            firstPlayoffMeeting:
                firstPlayoff
                    ? {
                        label:
                            firstPlayoff.label,

                        winner:
                            firstPlayoff.winner,

                        score:
                            `${firstPlayoff.managerOneScore}-${firstPlayoff.managerTwoScore}`
                    }
                    : null,

            mostRecentPlayoffMeeting:
                mostRecentPlayoff
                    ? {
                        label:
                            mostRecentPlayoff.label,

                        winner:
                            mostRecentPlayoff.winner,

                        score:
                            `${mostRecentPlayoff.managerOneScore}-${mostRecentPlayoff.managerTwoScore}`
                    }
                    : null,

            firstMeetingOfAnyType:
                firstOverall
                    ? {
                        label:
                            firstOverall.label,

                        type:
                            firstOverall.type,

                        winner:
                            firstOverall.winner,

                        score:
                            `${firstOverall.managerOneScore}-${firstOverall.managerTwoScore}`
                    }
                    : null,

            mostRecentMeetingOfAnyType:
                mostRecentOverall
                    ? {
                        label:
                            mostRecentOverall.label,

                        type:
                            mostRecentOverall.type,

                        winner:
                            mostRecentOverall.winner,

                        score:
                            `${mostRecentOverall.managerOneScore}-${mostRecentOverall.managerTwoScore}`
                    }
                    : null
        },


        /*
            THIS is the authoritative historical timeline.
        */
        chronology: {
            regularSeasonLedger:
                regularLedger,

            playoffLedger:
                playoffLedger,

            combinedLedger:
                combinedLedger
        },


        streaks: {
            regularSeason: {
                current:
                    currentRegularStreak,

                longestByManager:
                    regularStreaks.longest,

                allWinningStreaks:
                    regularStreaks.all
            },

            playoffs: {
                current:
                    currentPlayoffStreak,

                longestByManager:
                    playoffStreaks.longest,

                allWinningStreaks:
                    playoffStreaks.all
            }
        },


        recentRegularSeason: {
            last3:
                recentWindow(
                    regularGames,
                    3,
                    managerOneName,
                    managerTwoName
                ),

            last5:
                recentWindow(
                    regularGames,
                    5,
                    managerOneName,
                    managerTwoName
                ),

            last10:
                recentWindow(
                    regularGames,
                    10,
                    managerOneName,
                    managerTwoName
                )
        },


        scoring: {
            regularSeason: {
                [managerOneName]:
                    individualScoreStats(
                        regularGames,
                        managerOneName,
                        'managerOneScore'
                    ),

                [managerTwoName]:
                    individualScoreStats(
                        regularGames,
                        managerTwoName,
                        'managerTwoScore'
                    ),

                averageMargin:
                    average(
                        regularGames.map(
                            game =>
                                game.margin
                        )
                    ),

                medianMargin:
                    median(
                        regularGames.map(
                            game =>
                                game.margin
                        )
                    ),

                extremes:
                    regularExtremes
            },

            playoffs: {
                [managerOneName]:
                    individualScoreStats(
                        playoffGames,
                        managerOneName,
                        'managerOneScore'
                    ),

                [managerTwoName]:
                    individualScoreStats(
                        playoffGames,
                        managerTwoName,
                        'managerTwoScore'
                    ),

                averageMargin:
                    average(
                        playoffGames.map(
                            game =>
                                game.margin
                        )
                    ),

                medianMargin:
                    median(
                        playoffGames.map(
                            game =>
                                game.margin
                        )
                    ),

                extremes:
                    playoffExtremes
            },

            combined: {
                extremes:
                    overallExtremes
            }
        },


        seasonBySeason: {
            regularSeason:
                buildSeasonHistory(
                    regularGames,
                    managerOneName,
                    managerTwoName
                ),

            playoffs:
                buildSeasonHistory(
                    playoffGames,
                    managerOneName,
                    managerTwoName
                ),

            allMeetings:
                buildSeasonHistory(
                    allGames,
                    managerOneName,
                    managerTwoName
                )
        },


        seriesLeadHistory: {
            regularSeason:
                buildLeadHistory(
                    regularLedger,
                    managerOneName,
                    managerTwoName
                ),

            combined:
                buildLeadHistory(
                    combinedLedger,
                    managerOneName,
                    managerTwoName
                ),

            maximumRegularSeasonLead:
                maximumSeriesLead(
                    regularLedger,
                    managerOneName,
                    managerTwoName
                ),

            maximumCombinedLead:
                maximumSeriesLead(
                    combinedLedger,
                    managerOneName,
                    managerTwoName
                )
        },


        trades: {
            count:
                tradeHistory.length,

            seasons:
                [
                    ...new Set(
                        tradeHistory
                            .map(
                                trade =>
                                    trade.season
                            )
                            .filter(Boolean)
                    )
                ]
        },


        overallCareerContext: {
            note:
                'These statistics describe each manager against the entire league, NOT specifically this opponent.',

            [managerOneName]:
                performanceSummary(
                    playerOneRecords
                ),

            [managerTwoName]:
                performanceSummary(
                    playerTwoRecords
                )
        },


        /*
            Raw normalized games remain available if the writer
            needs exact scores, but the calculated sections above
            should be preferred.
        */
        verifiedGames: {
            regularSeason:
                chronologicalSort(
                    regularGames
                ),

            playoffs:
                chronologicalSort(
                    playoffGames
                )
        }
    };
};
