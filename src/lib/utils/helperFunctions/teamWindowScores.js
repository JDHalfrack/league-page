import { predictScores } from './predictOptimalScore';

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

    const firstWeek = Math.max(1, Math.min(parseInt(currentWeek) || 1, 18));
    const finalWeek = 18;

    const rawScores = {};

    for (const roster of rosters) {
        const rosterID = roster.roster_id;

        const rosterPlayers = (roster.players || [])
            .map(playerID => {
                const player = players[playerID];
                if (!player) return null;

                return {
                    ...player,
                    playerID
                };
            })
            .filter(Boolean);

        // 1. CURRENT STRENGTH
        let currentStrengthRaw = 0;

        for (let week = firstWeek; week <= finalWeek; week++) {
            currentStrengthRaw += predictScores(
                rosterPlayers,
                week,
                leagueData
            );
        }

        // 2. YOUTH / FUTURE VALUE
        const dynastyPlayers = rosterPlayers.filter(player =>
            ['QB', 'RB', 'WR', 'TE'].includes(player.pos)
        );

        let youthWeightedTotal = 0;
        let youthWeightTotal = 0;

        for (const player of dynastyPlayers) {
            const ageScore = getAgeValue(player.pos, player.age);

            if (ageScore === null) continue;

            const seasonProjection = getRemainingProjection(
                player,
                firstWeek,
                finalWeek
            );

            const weight = 1 + seasonProjection / 100;

            youthWeightedTotal += ageScore * weight;
            youthWeightTotal += weight;
        }

        const youthRaw =
            youthWeightTotal > 0
                ? youthWeightedTotal / youthWeightTotal
                : 50;

        // 3. DEPTH
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

        const CORE_PLAYER_COUNT = 8;

        const depthPlayers = projectedSkillPlayers.slice(CORE_PLAYER_COUNT);

        let depthRaw = 0;
        const usefulDepth = depthPlayers.slice(0, 6);

        for (let i = 0; i < usefulDepth.length; i++) {
            const depthWeight = Math.max(0.5, 1 - i * 0.1);
            depthRaw += usefulDepth[i].projection * depthWeight;
        }

        rawScores[rosterID] = {
            strengthRaw: currentStrengthRaw,
            youthRaw,
            depthRaw
        };
    }

    // Normalize the component scores
    const strengthValues = Object.values(rawScores).map(team => team.strengthRaw);
    const youthValues = Object.values(rawScores).map(team => team.youthRaw);
    const depthValues = Object.values(rawScores).map(team => team.depthRaw);

    const componentScores = {};

    for (const rosterID in rawScores) {
        const team = rawScores[rosterID];

        const strength = normalize(team.strengthRaw, strengthValues);
        const youth = normalize(team.youthRaw, youthValues);
        const depth = normalize(team.depthRaw, depthValues);

        componentScores[rosterID] = {
            strength,
            youth,
            depth,
            winNowRaw:
                strength * 0.80 +
                depth * 0.20,
            dynastyRaw:
                strength * 0.45 +
                youth * 0.35 +
                depth * 0.20,
            rebuildRaw:
                youth * 0.55 +
                depth * 0.25 +
                (100 - strength) * 0.20
        };
    }

    // Re-normalize FINAL WN / DYN / REB so each category's top team = 100
    const winNowValues = Object.values(componentScores).map(team => team.winNowRaw);
    const dynastyValues = Object.values(componentScores).map(team => team.dynastyRaw);
    const rebuildValues = Object.values(componentScores).map(team => team.rebuildRaw);

    const finalScores = {};

    for (const rosterID in componentScores) {
        const team = componentScores[rosterID];

        finalScores[rosterID] = {
            winNow: roundScore(normalize(team.winNowRaw, winNowValues)),
            dynasty: roundScore(normalize(team.dynastyRaw, dynastyValues)),
            rebuild: roundScore(normalize(team.rebuildRaw, rebuildValues)),

            components: {
                strength: roundScore(team.strength),
                youth: roundScore(team.youth),
                depth: roundScore(team.depth)
            }
        };
    }

    return finalScores;
};

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
            const percentage = (age - age1) / (age2 - age1);
            return value1 + (value2 - value1) * percentage;
        }
    }

    return 50;
};

const getRemainingProjection = (player, firstWeek, finalWeek) => {
    if (!player?.wi) {
        return 0;
    }

    let total = 0;

    for (let week = firstWeek; week <= finalWeek; week++) {
        const projection = parseFloat(player.wi?.[week]?.p ?? 0);

        if (Number.isFinite(projection)) {
            total += projection;
        }
    }

    return total;
};

const normalize = (value, values) => {
    if (!values.length) {
        return 50;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max === min) {
        return 50;
    }

    return clamp(((value - min) / (max - min)) * 100, 0, 100);
};

const roundScore = value => {
    return Math.round(clamp(value, 0, 100));
};

const clamp = (value, min, max) => {
    return Math.min(max, Math.max(min, value));
};
