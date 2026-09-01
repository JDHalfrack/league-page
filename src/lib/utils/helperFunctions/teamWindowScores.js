import { predictScores } from './predictOptimalScore';

/*
    Calculates three 0-100 scores for every roster:

    WN  = Win Now
    DYN = Dynasty
    REB = Rebuild

    Expected input:
    {
        rostersData,
        players,
        leagueData,
        currentWeek
    }

    Returns:
    {
        [rosterID]: {
            winNow: 0-100,
            dynasty: 0-100,
            rebuild: 0-100,

            // useful for debugging later
            components: {
                strength: 0-100,
                youth: 0-100,
                depth: 0-100
            }
        }
    }
*/

export const calculateTeamWindowScores = ({
    rostersData,
    players,
    leagueData,
    currentWeek = 1
}) => {
    if (!rostersData?.rosters || !players || !leagueData) {
        return {};
    }

    const rosters = Object.values(rostersData.rosters);

    if (!rosters.length) {
        return {};
    }

    // Sleeper projections in this project currently cover the NFL regular season.
    // Keep this consistent with the existing Power Rankings logic.
    const firstWeek = Math.max(1, Math.min(parseInt(currentWeek) || 1, 18));
    const finalWeek = 18;

    const rawScores = {};

    for (const roster of rosters) {
        const rosterID = roster.roster_id;

        const rosterPlayers = (roster.players || [])
            .map(playerID => {
                const player = players[playerID];

                if (!player) {
                    return null;
                }

                return {
                    ...player,
                    playerID
                };
            })
            .filter(Boolean);

        /*
            ------------------------------------------------
            1. CURRENT / REST-OF-SEASON STRENGTH
            ------------------------------------------------

            Reuse the same optimal-lineup projection system that
            powers the existing Power Rankings calculation.
        */

        let currentStrengthRaw = 0;

        for (let week = firstWeek; week <= finalWeek; week++) {
            currentStrengthRaw += predictScores(
                rosterPlayers,
                week,
                leagueData
            );
        }

        /*
            ------------------------------------------------
            2. YOUTH / FUTURE VALUE
            ------------------------------------------------

            Only fantasy-relevant offensive positions are used here.

            Each player's age score is weighted partly by projected
            production, so an elite young starter matters more than
            a random young bench player.

            However, every eligible player receives a base weight,
            so prospects with little immediate projection still count.
        */

        const dynastyPlayers = rosterPlayers.filter(player =>
            ['QB', 'RB', 'WR', 'TE'].includes(player.pos)
        );

        let youthWeightedTotal = 0;
        let youthWeightTotal = 0;

        for (const player of dynastyPlayers) {
            const ageScore = getAgeValue(player.pos, player.age);

            if (ageScore === null) {
                continue;
            }

            const seasonProjection = getRemainingProjection(
                player,
                firstWeek,
                finalWeek
            );

            // Every rostered dynasty player matters at least somewhat.
            // Productive players receive additional weight.
            const weight = 1 + seasonProjection / 100;

            youthWeightedTotal += ageScore * weight;
            youthWeightTotal += weight;
        }

        const youthRaw =
            youthWeightTotal > 0
                ? youthWeightedTotal / youthWeightTotal
                : 50;

        /*
            ------------------------------------------------
            3. DEPTH
            ------------------------------------------------

            Estimate the amount of usable production beyond the
            roster's top fantasy assets.

            We calculate remaining-season projections for every
            QB/RB/WR/TE and sort them.

            The first group represents the core lineup.
            Players behind that group contribute to depth.
        */

        const projectedSkillPlayers = dynastyPlayers
            .map(player => ({
                player,
                projection: getRemainingProjection(
                    player,
                    firstWeek,
                    finalWeek
                )
            }))
            .sort((a, b) => b.projection - a.projection);

        /*
            This league starts roughly:
              1 QB
              2 RB
              3 WR
              1 TE
              1 FLEX

            So the top 8 skill players approximate a core lineup.
            Everything after that represents usable depth.
        */
        const CORE_PLAYER_COUNT = 8;

        const depthPlayers = projectedSkillPlayers.slice(
            CORE_PLAYER_COUNT
        );

        let depthRaw = 0;

        /*
            Do not let a giant bench create unlimited depth value.
            The six most useful players behind the core matter most.
        */
        const usefulDepth = depthPlayers.slice(0, 6);

        for (let i = 0; i < usefulDepth.length; i++) {
            /*
                Slight diminishing returns:

                best bench asset  = 100%
                second           = 90%
                third            = 80%
                ...
            */
            const depthWeight = Math.max(0.5, 1 - i * 0.1);

            depthRaw += usefulDepth[i].projection * depthWeight;
        }

        rawScores[rosterID] = {
            strengthRaw: currentStrengthRaw,
            youthRaw,
            depthRaw
        };
    }

    /*
        ------------------------------------------------
        NORMALIZE AGAINST THE LEAGUE
        ------------------------------------------------

        This means a score represents where a team stands compared
        with the other USCCFFL rosters rather than an arbitrary
        universal fantasy-football scale.
    */

    const strengthValues = Object.values(rawScores).map(
        team => team.strengthRaw
    );

    const youthValues = Object.values(rawScores).map(
        team => team.youthRaw
    );

    const depthValues = Object.values(rawScores).map(
        team => team.depthRaw
    );

    const finalScores = {};

    for (const rosterID in rawScores) {
        const team = rawScores[rosterID];

        const strength = normalize(
            team.strengthRaw,
            strengthValues
        );

        const youth = normalize(
            team.youthRaw,
            youthValues
        );

        const depth = normalize(
            team.depthRaw,
            depthValues
        );

        /*
            ------------------------------------------------
            FINAL SCORES
            ------------------------------------------------
        */

        // How capable is this team of winning right now?
        const winNow =
            strength * 0.80 +
            depth * 0.20;

        // How strong is the franchise both now and going forward?
        const dynasty =
            strength * 0.45 +
            youth * 0.35 +
            depth * 0.20;

        /*
            Rebuild is intentionally NOT just 100 - Win Now.

            A good rebuilding roster should:
              - be young
              - have useful depth/assets
              - generally be less competitive immediately

            This allows a young powerhouse to have good dynasty value
            without automatically being classified as a rebuild.
        */
        const rebuild =
            youth * 0.55 +
            depth * 0.25 +
            (100 - strength) * 0.20;

        finalScores[rosterID] = {
            winNow: roundScore(winNow),
            dynasty: roundScore(dynasty),
            rebuild: roundScore(rebuild),

            components: {
                strength: roundScore(strength),
                youth: roundScore(youth),
                depth: roundScore(depth)
            }
        };
    }

    return finalScores;
};


/*
    ====================================================
    PLAYER AGE CURVES
    ====================================================

    Returns a 0-100 future-value score based on position
    and age.

    These are intentionally different by position because
    NFL aging curves are very different for RBs versus QBs.
*/

const getAgeValue = (position, age) => {
    age = parseFloat(age);

    if (!Number.isFinite(age)) {
        return null;
    }

    switch (position) {
        case 'QB':
            return interpolateAge(age, [
                [20, 90],
                [23, 100],
                [26, 100],
                [29, 92],
                [31, 82],
                [33, 68],
                [35, 48],
                [37, 28],
                [40, 10]
            ]);

        case 'RB':
            return interpolateAge(age, [
                [20, 95],
                [21, 100],
                [23, 100],
                [24, 92],
                [25, 82],
                [26, 68],
                [27, 52],
                [28, 35],
                [29, 20],
                [31, 5]
            ]);

        case 'WR':
            return interpolateAge(age, [
                [20, 95],
                [22, 100],
                [24, 100],
                [25, 96],
                [27, 88],
                [28, 76],
                [29, 63],
                [30, 48],
                [31, 32],
                [33, 12],
                [35, 5]
            ]);

        case 'TE':
            return interpolateAge(age, [
                [20, 88],
                [22, 96],
                [24, 100],
                [26, 100],
                [27, 95],
                [28, 87],
                [29, 76],
                [30, 62],
                [31, 47],
                [33, 24],
                [35, 8]
            ]);

        default:
            return null;
    }
};


/*
    Linearly interpolate between age/value points.

    Example:
        age 26.5 between:
            26 => 100
            27 => 95

        returns about 97.5
*/
const interpolateAge = (age, points) => {
    if (age <= points[0][0]) {
        return points[0][1];
    }

    const lastPoint = points[points.length - 1];

    if (age >= lastPoint[0]) {
        return lastPoint[1];
    }

    for (let i = 0; i < points.length - 1; i++) {
        const [age1, value1] = points[i];
        const [age2, value2] = points[i + 1];

        if (age >= age1 && age <= age2) {
            const percentage =
                (age - age1) /
                (age2 - age1);

            return (
                value1 +
                (value2 - value1) * percentage
            );
        }
    }

    return 50;
};


/*
    Sum one player's projections over the remaining season.
*/
const getRemainingProjection = (
    player,
    firstWeek,
    finalWeek
) => {
    if (!player?.wi) {
        return 0;
    }

    let total = 0;

    for (let week = firstWeek; week <= finalWeek; week++) {
        const projection = parseFloat(
            player.wi?.[week]?.p ?? 0
        );

        if (Number.isFinite(projection)) {
            total += projection;
        }
    }

    return total;
};


/*
    Convert a raw league value to a 0-100 scale.

    Best team = 100
    Worst team = 0
*/
const normalize = (value, values) => {
    if (!values.length) {
        return 50;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max === min) {
        return 50;
    }

    return clamp(
        ((value - min) / (max - min)) * 100,
        0,
        100
    );
};


const roundScore = value => {
    return Math.round(
        clamp(value, 0, 100)
    );
};


const clamp = (value, min, max) => {
    return Math.min(
        max,
        Math.max(min, value)
    );
};
