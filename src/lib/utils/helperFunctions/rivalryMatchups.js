import { getLeagueData } from "./leagueData";
import { leagueID } from '$lib/utils/leagueInfo';
import { waitForAll } from './multiPromise';

import {
    getRosterIDFromManagerIDAndYear
} from '$lib/utils/helperFunctions/universalFunctions';

import {
    getLeagueTeamManagers
} from "./leagueTeamManagers";


export const getRivalryMatchups = async (
    userOneID,
    userTwoID
) => {
    if (!userOneID || !userTwoID) {
        return;
    }

    let curLeagueID = leagueID;

    const teamManagers =
        await getLeagueTeamManagers()
            .catch(err => {
                console.error(err);
            });

    const rivalry = {
        regularSeason: createRivalryBucket(),
        playoffs: createRivalryBucket()
    };


    /*
        Walk backward through every linked Sleeper season.
    */
    while (
        curLeagueID &&
        curLeagueID != 0
    ) {
        const leagueData =
            await getLeagueData(curLeagueID)
                .catch(err => {
                    console.error(err);
                });

        if (!leagueData) {
            break;
        }

        const year = leagueData.season;

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


        /*
            If one manager wasn't in the league that year,
            or they shared the same roster, skip the season.
        */
        if (
            !rosterIDOne ||
            !rosterIDTwo ||
            rosterIDOne == rosterIDTwo
        ) {
            curLeagueID =
                leagueData.previous_league_id;

            continue;
        }


        const playoffStartWeek =
            parseInt(
                leagueData.settings
                    .playoff_week_start
            );


        /*
            ==========================================
            REGULAR SEASON
            ==========================================
        */

        const regularSeasonPromises = [];

        for (
            let week = 1;
            week < playoffStartWeek;
            week++
        ) {
            regularSeasonPromises.push(
                fetch(
                    `https://api.sleeper.app/v1/league/${curLeagueID}/matchups/${week}`,
                    {
                        compress: true
                    }
                )
            );
        }


        const regularSeasonResponses =
            await waitForAll(
                ...regularSeasonPromises
            );


        const regularSeasonJSONPromises = [];

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


        for (
            let i = 0;
            i < regularSeasonData.length;
            i++
        ) {
            const week = i + 1;

            const processed =
                processRivalryMatchups(
                    regularSeasonData[i],
                    week,
                    rosterIDOne,
                    rosterIDTwo
                );

            if (processed) {
                addMatchup(
                    rivalry.regularSeason,
                    processed.matchup,
                    year,
                    week,
                    null
                );
            }
        }


        /*
            ==========================================
            WINNERS-BRACKET PLAYOFFS ONLY
            ==========================================
        */

        const winnersBracketResponse =
            await fetch(
                `https://api.sleeper.app/v1/league/${curLeagueID}/winners_bracket`,
                {
                    compress: true
                }
            );


        let winnersBracket = [];

        if (winnersBracketResponse.ok) {
            winnersBracket =
                await winnersBracketResponse.json();
        }


        if (
            Array.isArray(winnersBracket) &&
            winnersBracket.length
        ) {
            /*
                Only an exact pairing in Sleeper's
                winners bracket qualifies as a playoff
                rivalry game.

                Consolation/lower-bracket games never
                qualify here.
            */
            const rivalryPlayoffNodes =
                winnersBracket.filter(node => {
                    const teamOne =
                        parseInt(node.t1);

                    const teamTwo =
                        parseInt(node.t2);

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
                });


            for (
                const bracketNode
                of rivalryPlayoffNodes
            ) {
                const round =
                    parseInt(bracketNode.r);

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
                            compress: true
                        }
                    );


                if (!matchupResponse.ok) {
                    continue;
                }


                const matchupData =
                    await matchupResponse.json();


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


        curLeagueID =
            leagueData.previous_league_id;
    }


    /*
        Newest games first.
    */
    sortMatchups(
        rivalry.regularSeason.matchups
    );

    sortMatchups(
        rivalry.playoffs.matchups
    );


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
            one: 0,
            two: 0
        },

        wins: {
            one: 0,
            two: 0
        },

        ties: 0,

        matchups: []
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
        !Array.isArray(side.points)
    ) {
        return 0;
    }

    return side.points.reduce(
        (total, value) =>
            total +
            (Number(value) || 0),
        0
    );
};


/*
    =====================================================
    ADD ONE COMPLETED MATCHUP

    IMPORTANT:
    A 0-0 matchup is treated as UNPLAYED.
    It is not counted as a tie and it is not added
    to the matchup history.
    =====================================================
*/

const addMatchup = (
    bucket,
    matchup,
    year,
    week,
    label = null
) => {
    const sideA = matchup?.[0];
    const sideB = matchup?.[1];

    if (
        !sideA ||
        !sideB
    ) {
        return false;
    }


    const sideAPoints =
        getSidePoints(sideA);

    const sideBPoints =
        getSidePoints(sideB);


    /*
        Sleeper can create future matchup shells that
        appear as 0-0.

        Those games have NOT been played.
    */
    if (
        sideAPoints === 0 &&
        sideBPoints === 0
    ) {
        return false;
    }


    bucket.points.one += sideAPoints;
    bucket.points.two += sideBPoints;


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
    PROCESS SLEEPER WEEK
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


    const matchups = {};


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
                        ? match.starters_points
                        : []
            });
        }
    }


    const keys =
        Object.keys(matchups);


    /*
        Both teams must be members of exactly the
        same Sleeper matchup.
    */
    if (keys.length != 1) {
        return;
    }


    const matchup =
        matchups[keys[0]];


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
        matchup[0].roster_id ==
        rosterIDTwo
    ) {
        const two =
            matchup.shift();

        matchup.push(two);
    }


    /*
        Defense-in-depth:
        discard an unplayed 0-0 game here too.
    */
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
    PLAYOFF ROUND LABEL
    =====================================================
*/

const getPlayoffRoundLabel = (
    round,
    winnersBracket
) => {
    const rounds =
        winnersBracket
            .map(node =>
                parseInt(node.r)
            )
            .filter(
                value =>
                    Number.isFinite(value)
            );


    if (!rounds.length) {
        return `Playoff Round ${round}`;
    }


    const finalRound =
        Math.max(...rounds);


    if (round == finalRound) {
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


    return `Playoff Round ${round}`;
};


/*
    =====================================================
    SORT NEWEST -> OLDEST
    =====================================================
*/

const sortMatchups = matchups => {
    matchups.sort((a, b) => {
        const yearOrder =
            b.year - a.year;

        const weekOrder =
            b.week - a.week;

        return (
            yearOrder ||
            weekOrder
        );
    });
};
