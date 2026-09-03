import { cfbdGet } from '$lib/server/cfbd';

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K']);
const MIN_GRADE = 40;
const MAX_GRADE = 99;
const REQUEST_GAP_MS = 25;
const MODEL_VERSION = '0.3.3';

const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

const cleanKey = value =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

const normalizePosition = value => {
    const position = String(value || '').toUpperCase();
    return position === 'PK' ? 'K' : position;
};

const toNumber = value => {
    const number = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(number) ? number : 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const safeRate = (numerator, denominator) =>
    denominator > 0 ? numerator / denominator : 0;

const percentileMap = (rows, valueAccessor) => {
    const valid = rows
        .map(row => ({ id: row.id, value: Number(valueAccessor(row)) }))
        .filter(row => Number.isFinite(row.value))
        .sort((a, b) => a.value - b.value);

    const result = new Map();

    if (!valid.length) return result;

    if (valid.length === 1) {
        result.set(valid[0].id, 50);
        return result;
    }

    valid.forEach((row, index) => {
        result.set(row.id, (index / (valid.length - 1)) * 100);
    });

    return result;
};

const scalePercentileToGrade = percentile =>
    Math.round(
        (
            MIN_GRADE +
            (clamp(percentile, 0, 100) / 100) * (MAX_GRADE - MIN_GRADE)
        ) * 10
    ) / 10;

const tierForGrade = grade => {
    if (grade >= 95) return 'Generational';
    if (grade >= 90) return 'Elite Dynasty Prospect';
    if (grade >= 85) return 'Strong 1st-Round Prospect';
    if (grade >= 80) return 'Good Prospect';
    if (grade >= 75) return 'Developmental';
    return 'Sleeper / Long Shot';
};

const weightsForPosition = position => {
    if (position === 'QB') {
        return {
            production: 0.37,
            efficiency: 0.28,
            development: 0.08,
            pedigree: 0.10,
            size: 0.08,
            versatility: 0.09
        };
    }

    if (position === 'RB') {
        return {
            production: 0.39,
            efficiency: 0.20,
            development: 0.08,
            pedigree: 0.09,
            size: 0.08,
            versatility: 0.16
        };
    }

    if (position === 'TE') {
        return {
            production: 0.36,
            efficiency: 0.23,
            development: 0.08,
            pedigree: 0.10,
            size: 0.10,
            versatility: 0.13
        };
    }

    if (position === 'K') {
        return {
            production: 0.46,
            efficiency: 0.34,
            development: 0.08,
            pedigree: 0.04,
            size: 0.00,
            versatility: 0.08
        };
    }

    return {
        production: 0.40,
        efficiency: 0.23,
        development: 0.08,
        pedigree: 0.10,
        size: 0.08,
        versatility: 0.11
    };
};

const positionValueAdjustment = position => {
    if (position === 'WR') return 2.0;
    if (position === 'RB') return 1.4;
    if (position === 'QB') return 0.2;
    if (position === 'TE') return 0;
    if (position === 'K') return -18.0;
    return 0;
};

const addCategoryStat = (target, category, statType, amount) => {
    const cat = cleanKey(category || 'other');
    const key = cleanKey(statType);

    if (!target[cat]) {
        target[cat] = {};
    }

    target[cat][key] = (target[cat][key] || 0) + amount;
};

const statFrom = (category, aliases) => {
    for (const alias of aliases) {
        const key = cleanKey(alias);
        if (category[key] !== undefined) return category[key];
    }

    return 0;
};

const calculateRawMetrics = categoryStats => {
    const passing = categoryStats?.passing || {};
    const rushing = categoryStats?.rushing || {};
    const receiving = categoryStats?.receiving || {};
    const kicking =
        categoryStats?.kicking ||
        categoryStats?.fieldgoals ||
        categoryStats?.scoring ||
        {};

    const pYds = statFrom(passing, ['YDS', 'passingYards', 'passYards']);
    const pTD = statFrom(passing, ['TD', 'passingTDs', 'passTD']);
    const pAtt = statFrom(passing, ['ATT', 'passingAttempts', 'passAttempts']);
    const pCmp = statFrom(passing, ['COMPLETIONS', 'CMP', 'completions']);
    const pInt = statFrom(passing, ['INT', 'interceptions']);

    const rYds = statFrom(rushing, ['YDS', 'rushingYards', 'rushYards']);
    const rTD = statFrom(rushing, ['TD', 'rushingTDs', 'rushTD']);
    const rAtt = statFrom(rushing, ['CAR', 'ATT', 'rushingAttempts', 'carries']);

    const catches = statFrom(receiving, ['REC', 'receptions']);
    const reYds = statFrom(receiving, ['YDS', 'receivingYards', 'recYards']);
    const reTD = statFrom(receiving, ['TD', 'receivingTDs', 'recTD']);

    const fgMade = statFrom(kicking, [
        'FGM',
        'fieldGoalsMade',
        'madeFieldGoals',
        'made'
    ]);
    const fgAttempts = statFrom(kicking, [
        'FGA',
        'fieldGoalAttempts',
        'attemptedFieldGoals',
        'attempts'
    ]);
    const xpMade = statFrom(kicking, [
        'XPM',
        'PAT',
        'extraPointsMade',
        'madeExtraPoints'
    ]);
    const xpAttempts = statFrom(kicking, [
        'XPA',
        'extraPointAttempts',
        'attemptedExtraPoints'
    ]);
    const longFg = statFrom(kicking, [
        'LONG',
        'long',
        'longestFieldGoal'
    ]);

    return {
        passing: {
            yards: pYds,
            touchdowns: pTD,
            attempts: pAtt,
            completions: pCmp,
            interceptions: pInt
        },
        rushing: {
            yards: rYds,
            touchdowns: rTD,
            attempts: rAtt
        },
        receiving: {
            receptions: catches,
            yards: reYds,
            touchdowns: reTD
        },
        kicking: {
            fieldGoalsMade: fgMade,
            fieldGoalAttempts: fgAttempts,
            extraPointsMade: xpMade,
            extraPointAttempts: xpAttempts,
            long: longFg
        }
    };
};

const positionMetrics = (position, totals) => {
    const pYds = totals.passing.yards;
    const pTD = totals.passing.touchdowns;
    const pAtt = totals.passing.attempts;
    const pCmp = totals.passing.completions;
    const pInt = totals.passing.interceptions;

    const rYds = totals.rushing.yards;
    const rTD = totals.rushing.touchdowns;
    const rAtt = totals.rushing.attempts;

    const catches = totals.receiving.receptions;
    const reYds = totals.receiving.yards;
    const reTD = totals.receiving.touchdowns;

    const fgMade = totals.kicking?.fieldGoalsMade || 0;
    const fgAttempts = totals.kicking?.fieldGoalAttempts || 0;
    const xpMade = totals.kicking?.extraPointsMade || 0;
    const xpAttempts = totals.kicking?.extraPointAttempts || 0;
    const longFg = totals.kicking?.long || 0;

    let productionRaw = 0;
    let efficiencyRaw = 0;
    let versatilityRaw = 0;

    if (position === 'QB') {
        productionRaw =
            pYds / 35 +
            pTD * 5 -
            pInt * 2 +
            rYds / 12 +
            rTD * 5;

        efficiencyRaw =
            safeRate(pYds, pAtt) * 8 +
            safeRate(pTD, pAtt) * 500 -
            safeRate(pInt, pAtt) * 350 +
            safeRate(pCmp, pAtt) * 35;

        versatilityRaw = rYds / 10 + rTD * 5;
    } else if (position === 'RB') {
        const touches = rAtt + catches;

        productionRaw =
            rYds / 10 +
            rTD * 7 +
            reYds / 12 +
            reTD * 7 +
            catches * 0.8;

        efficiencyRaw =
            safeRate(rYds, rAtt) * 11 +
            safeRate(reYds, catches) * 3 +
            safeRate(rTD + reTD, touches) * 220;

        versatilityRaw =
            catches * 1.7 +
            reYds / 10 +
            reTD * 6;
    } else if (position === 'K') {
        productionRaw =
            fgMade * 4 +
            xpMade * 0.75 +
            Math.max(0, longFg - 40) * 0.20;

        efficiencyRaw =
            safeRate(fgMade, fgAttempts) * 100 +
            safeRate(xpMade, xpAttempts) * 25 +
            Math.max(0, longFg - 45) * 0.75;

        versatilityRaw =
            Math.max(0, longFg - 35) * 1.5;
    } else {
        productionRaw =
            reYds / 10 +
            reTD * 8 +
            catches * 1.1 +
            rYds / 15 +
            rTD * 6;

        efficiencyRaw =
            safeRate(reYds, catches) * 5 +
            safeRate(reTD, catches) * 180;

        versatilityRaw =
            rYds / 8 +
            rTD * 6;
    }

    return {
        productionRaw,
        efficiencyRaw,
        versatilityRaw
    };
};

const normalizeRecruitRating = rating => {
    const value = Number(rating);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value <= 1.2 ? value * 100 : value;
};

const normalizeHeightInches = height => {
    const value = Number(height);
    if (!Number.isFinite(value) || value <= 0) return null;

    /*
        CFBD recruiting data is normally inches. The second branch keeps this
        tolerant if a future response is supplied in feet.
    */
    if (value < 10) return value * 12;
    return value;
};

const normalizeWeight = weight => {
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
};

const formatHeight = inches => {
    const value = normalizeHeightInches(inches);
    if (!value) return null;

    return `${Math.floor(value / 12)}′${Math.round(value % 12)}″`;
};

const rangeScore = (value, min, max, tolerance) => {
    if (!Number.isFinite(value)) return null;

    if (value >= min && value <= max) {
        return 100;
    }

    const distance = value < min ? min - value : value - max;
    return clamp(100 - (distance / tolerance) * 45, 45, 100);
};

const sizeScoreForPosition = (position, height, weight) => {
    const h = normalizeHeightInches(height);
    const w = normalizeWeight(weight);

    const profiles = {
        QB: {
            height: [74, 77, 4],
            weight: [215, 238, 35],
            heightWeight: [0.50, 0.50]
        },
        RB: {
            height: [68, 72, 4],
            weight: [200, 225, 30],
            heightWeight: [0.35, 0.65]
        },
        WR: {
            height: [70, 76, 5],
            weight: [185, 220, 35],
            heightWeight: [0.55, 0.45]
        },
        TE: {
            height: [74, 78, 4],
            weight: [235, 260, 35],
            heightWeight: [0.45, 0.55]
        }
    };

    const profile = profiles[position];
    if (!profile) return 50;

    const heightScore = h
        ? rangeScore(h, ...profile.height)
        : null;

    const weightScore = w
        ? rangeScore(w, ...profile.weight)
        : null;

    if (heightScore === null && weightScore === null) return 50;
    if (heightScore === null) return weightScore;
    if (weightScore === null) return heightScore;

    return (
        heightScore * profile.heightWeight[0] +
        weightScore * profile.heightWeight[1]
    );
};

const collegeStage = (recruitYear, cutoffYear, observedSeasons) => {
    let yearNumber = null;
    let estimated = false;

    if (recruitYear) {
        yearNumber = cutoffYear - Number(recruitYear) + 1;
    }

    if (!Number.isFinite(yearNumber) || yearNumber <= 0) {
        yearNumber = Math.max(1, Number(observedSeasons) || 1);
        estimated = true;
    }

    let label = 'FR';
    let score = 82;

    if (yearNumber === 2) {
        label = 'SO';
        score = 92;
    } else if (yearNumber === 3) {
        label = 'JR';
        score = 97;
    } else if (yearNumber === 4) {
        label = 'SR';
        score = 92;
    } else if (yearNumber >= 5) {
        label = 'SR+';
        score = 88;
    }

    return {
        yearNumber,
        label,
        score,
        estimated
    };
};

const evidenceConfidence = observedSeasons => {
    const count = Math.max(1, Number(observedSeasons) || 1);

    if (count <= 1) return 0.70;
    if (count === 2) return 0.90;
    if (count === 3) return 0.97;
    return 1;
};

const confidenceAdjustedPercentile = (percentile, observedSeasons) => {
    const confidence = evidenceConfidence(observedSeasons);

    /*
        A tiny résumé should not be treated with the same certainty as three or
        four years of elite production. Pull small samples toward neutral.
    */
    return 50 + (percentile - 50) * confidence;
};

const eligibilityLabel = (recruitYear, cutoffYear) => {
    if (!recruitYear) return 'Eligibility unknown';

    return recruitYear <= cutoffYear - 2
        ? `${cutoffYear + 1} Eligible`
        : 'Future Class';
};

const draftOutcome = pick => {
    if (!pick) return null;

    const round = pick.round ?? null;
    const overall = pick.overall ?? pick.overallPick ?? pick.pick ?? null;
    const team = pick.nflTeam ?? pick.team ?? pick.nflTeamName ?? null;

    const parts = [];
    if (round) parts.push(`Round ${round}`);
    if (overall) parts.push(`Pick ${overall}`);
    if (team) parts.push(team);

    return {
        round,
        pick: overall,
        team,
        label: parts.join(', ') || 'Drafted'
    };
};

const runWithConcurrency = async (jobs, limit = 2) => {
    const results = new Array(jobs.length);
    let nextIndex = 0;

    const worker = async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= jobs.length) return;
            results[index] = await jobs[index]();
        }
    };

    await Promise.all(
        Array.from(
            { length: Math.min(limit, jobs.length) },
            () => worker()
        )
    );

    return results;
};

const fetchStatsThrough = async (cutoffYear, endWeek) => {
    const years = Array.from(
        { length: 6 },
        (_, index) => cutoffYear - 5 + index
    );

    const yearlyResults = await runWithConcurrency(
        years.map(year => async () => {
            const result = await cfbdGet('/stats/player/season', {
                year,
                seasonType: 'both',
                endWeek: year === cutoffYear ? endWeek : undefined
            });

            await sleep(REQUEST_GAP_MS);

            return result.map(row => ({
                ...row,
                season: Number(row.season ?? year),
                _requestedSeason: year
            }));
        }),
        2
    );

    return yearlyResults.flat();
};

const fetchRecruiting = async cutoffYear => {
    const years = Array.from(
        { length: 6 },
        (_, index) => cutoffYear - 5 + index
    );

    const yearlyResults = await runWithConcurrency(
        years.map(year => async () => {
            try {
                const result = await cfbdGet('/recruiting/players', {
                    year,
                    classification: 'HighSchool'
                });

                await sleep(REQUEST_GAP_MS);
                return result;
            } catch (err) {
                console.warn(
                    `CFBD recruiting ${year} unavailable:`,
                    err?.message || err
                );
                return [];
            }
        }),
        2
    );

    return yearlyResults.flat();
};

const fetchDraftPicksForYear = async year => {
    try {
        return await cfbdGet('/draft/picks', { year });
    } catch (err) {
        console.warn(
            `CFBD draft picks ${year} unavailable:`,
            err?.message || err
        );
        return [];
    }
};

const fetchDraftedPlayersBeforeProspectClass = async (
    prospectClass,
    currentYear
) => {
    const exclusionDraftYear = prospectClass - 1;

    if (exclusionDraftYear > currentYear) return [];

    return fetchDraftPicksForYear(exclusionDraftYear);
};

const buildDraftMap = picks => {
    const map = new Map();

    for (const pick of picks || []) {
        const id =
            pick.collegeAthleteId ??
            pick.cfbdId ??
            pick.collegePlayerId ??
            null;

        if (id) {
            map.set(String(id), pick);
        }
    }

    return map;
};

const buildDraftedIdSet = picks => {
    const ids = new Set();

    for (const pick of picks || []) {
        const id =
            pick.collegeAthleteId ??
            pick.cfbdId ??
            pick.collegePlayerId ??
            null;

        if (id) {
            ids.add(String(id));
        }
    }

    return ids;
};

const latestSeasonForPlayer = player => {
    const seasons = [...player.seasons]
        .filter(Number.isFinite)
        .sort((a, b) => b - a);

    return seasons[0] ?? null;
};

export const buildProspectBoard = async ({
    prospectClass,
    cutoffYear,
    endWeek = null,
    currentYear
}) => {
    const draftYear = prospectClass;
    /*
        Cold-load optimization: stats and recruiting run in parallel, while
        each endpoint family is capped at two concurrent year requests.
        SP+ is removed from this version to save another cold-load request.
    */
    const [statRows, recruits] = await Promise.all([
        fetchStatsThrough(cutoffYear, endWeek),
        fetchRecruiting(cutoffYear)
    ]);

    const [draftedBeforeClass, draftPicks] = await Promise.all([
        fetchDraftedPlayersBeforeProspectClass(
            prospectClass,
            currentYear
        ),
        draftYear <= currentYear
            ? fetchDraftPicksForYear(draftYear)
            : Promise.resolve([])
    ]);

    const draftedIdSet = buildDraftedIdSet(draftedBeforeClass);

    const players = new Map();

    for (const row of statRows) {
        const position = normalizePosition(row.position);
        if (!SKILL_POSITIONS.has(position)) continue;

        const id = String(row.playerId || '');
        if (!id) continue;

        if (!players.has(id)) {
            players.set(id, {
                id,
                name: row.player || 'Unknown Player',
                position,
                team: row.team || '',
                conference: row.conference || '',
                categoryStats: {},
                seasonCategoryStats: {},
                seasons: new Set()
            });
        }

        const player = players.get(id);
        const season = Number(row.season ?? row._requestedSeason);

        player.team = row.team || player.team;
        player.conference = row.conference || player.conference;

        if (Number.isFinite(season)) {
            player.seasons.add(season);

            if (!player.seasonCategoryStats[season]) {
                player.seasonCategoryStats[season] = {};
            }

            addCategoryStat(
                player.seasonCategoryStats[season],
                row.category,
                row.statType,
                toNumber(row.stat)
            );
        }

        addCategoryStat(
            player.categoryStats,
            row.category,
            row.statType,
            toNumber(row.stat)
        );
    }

    const recruitById = new Map();

    for (const recruit of recruits) {
        if (recruit?.athleteId) {
            recruitById.set(String(recruit.athleteId), recruit);
        }
    }

    const draftById = buildDraftMap(draftPicks);

    let rows = [...players.values()].map(player => {
        const recruit = recruitById.get(player.id) || null;
        const latestSeason = latestSeasonForPlayer(player);
        const careerTotals = calculateRawMetrics(player.categoryStats);
        const latestTotals = calculateRawMetrics(
            player.seasonCategoryStats[latestSeason] || {}
        );

        const seasonMetrics = [...player.seasons]
            .filter(Number.isFinite)
            .sort((a, b) => a - b)
            .map(season => {
                const totals = calculateRawMetrics(
                    player.seasonCategoryStats[season] || {}
                );

                return {
                    season,
                    totals,
                    metrics: positionMetrics(player.position, totals)
                };
            });

        const careerMetrics = positionMetrics(
            player.position,
            careerTotals
        );

        const latestMetrics = positionMetrics(
            player.position,
            latestTotals
        );

        const bestProductionSeason = seasonMetrics.reduce(
            (best, row) =>
                !best ||
                row.metrics.productionRaw >
                    best.metrics.productionRaw
                    ? row
                    : best,
            null
        );

        const bestEfficiencySeason = seasonMetrics.reduce(
            (best, row) =>
                !best ||
                row.metrics.efficiencyRaw >
                    best.metrics.efficiencyRaw
                    ? row
                    : best,
            null
        );

        const observedSeasons = Math.max(1, player.seasons.size);

        const careerAverageProduction =
            careerMetrics.productionRaw / observedSeasons;

        const careerAverageEfficiency =
            seasonMetrics.reduce(
                (sum, row) =>
                    sum + row.metrics.efficiencyRaw,
                0
            ) / observedSeasons;

        const careerAverageVersatility =
            careerMetrics.versatilityRaw / observedSeasons;

        const productionRaw =
            latestMetrics.productionRaw * 0.40 +
            (bestProductionSeason?.metrics.productionRaw ?? 0) * 0.35 +
            careerAverageProduction * 0.25;

        const efficiencyRaw =
            latestMetrics.efficiencyRaw * 0.45 +
            (bestEfficiencySeason?.metrics.efficiencyRaw ?? 0) * 0.30 +
            careerAverageEfficiency * 0.25;

        const versatilityRaw =
            latestMetrics.versatilityRaw * 0.50 +
            careerAverageVersatility * 0.50;

        const recruitYear = recruit?.year ?? null;
        const stage = collegeStage(
            recruitYear,
            cutoffYear,
            observedSeasons
        );

        const heightInches = normalizeHeightInches(recruit?.height);
        const weight = normalizeWeight(recruit?.weight);

        return {
            ...player,
            careerTotals,
            latestTotals,
            productionRaw,
            efficiencyRaw,
            versatilityRaw,
            latestSeason,
            observedSeasons,
            recruitYear,
            recruitingRating: normalizeRecruitRating(recruit?.rating),
            stars: recruit?.stars ?? null,
            heightInches,
            height: formatHeight(heightInches),
            weight,
            sizeRaw: sizeScoreForPosition(
                player.position,
                heightInches,
                weight
            ),
            collegeStage: stage
        };
    });

    rows = rows.filter(player => {
        const hasRecentCollegeProduction =
            player.seasons.has(cutoffYear) ||
            player.seasons.has(cutoffYear - 1);

        return (
            player.productionRaw > 1 &&
            hasRecentCollegeProduction &&
            !draftedIdSet.has(player.id)
        );
    });

    const scored = [];

    for (const position of SKILL_POSITIONS) {
        const peers = rows.filter(
            player => player.position === position
        );

        if (!peers.length) continue;

        const productionPct = percentileMap(
            peers,
            player => player.productionRaw
        );

        const efficiencyPct = percentileMap(
            peers,
            player => player.efficiencyRaw
        );

        const versatilityPct = percentileMap(
            peers,
            player => player.versatilityRaw
        );

        const pedigreePeers = peers.filter(
            player => player.recruitingRating !== null
        );

        const pedigreePct = percentileMap(
            pedigreePeers,
            player => player.recruitingRating
        );

        for (const player of peers) {
            const production = confidenceAdjustedPercentile(
                productionPct.get(player.id) ?? 50,
                player.observedSeasons
            );

            const efficiency = confidenceAdjustedPercentile(
                efficiencyPct.get(player.id) ?? 50,
                player.observedSeasons
            );

            const versatility = confidenceAdjustedPercentile(
                versatilityPct.get(player.id) ?? 50,
                player.observedSeasons
            );

            const pedigree =
                pedigreePct.get(player.id) ?? 50;

            const development = player.collegeStage.score;
            const size = player.sizeRaw;

            const weights = weightsForPosition(position);

            const footballComposite =
                production * weights.production +
                efficiency * weights.efficiency +
                development * weights.development +
                pedigree * weights.pedigree +
                size * weights.size +
                versatility * weights.versatility;

            const composite = clamp(
                footballComposite +
                    positionValueAdjustment(position),
                0,
                100
            );

            const uncappedGrade = scalePercentileToGrade(composite);

            /*
                Kicker ceiling:
                A kicker can still separate himself from other kickers, but even
                an absurd college kicking season does not make him a premium
                dynasty/NFL draft prospect ahead of viable QB/RB/WR/TE players.

                Keep K inside the Sleeper / Long Shot band on the universal
                prospect board. This is a positional-value ceiling, not a claim
                that the kicker himself is bad at kicking.
            */
            const grade =
                position === 'K'
                    ? Math.min(uncappedGrade, 69.9)
                    : uncappedGrade;

            const actualDraft = draftOutcome(
                draftById.get(player.id)
            );

            scored.push({
                id: player.id,
                name: player.name,
                position: player.position,
                school: player.team,
                conference: player.conference,
                grade,
                tier: tierForGrade(grade),
                status: eligibilityLabel(
                    player.recruitYear,
                    cutoffYear
                ),
                collegeClass: player.collegeStage.label,
                collegeClassEstimated:
                    player.collegeStage.estimated,
                recruitLabel: player.recruitYear
                    ? `${player.recruitYear} Recruit`
                    : 'Recruit year unknown',
                recruitYear: player.recruitYear,
                observedSeasons: player.observedSeasons,
                latestSeason: player.latestSeason,
                height: player.height,
                weight: player.weight,
                stars: player.stars,
                production: Math.round(
                    scalePercentileToGrade(production)
                ),
                efficiency: Math.round(
                    scalePercentileToGrade(efficiency)
                ),
                development: Math.round(
                    scalePercentileToGrade(development)
                ),
                ageProfile: Math.round(
                    scalePercentileToGrade(development)
                ),
                pedigree: Math.round(
                    scalePercentileToGrade(pedigree)
                ),
                size: Math.round(
                    scalePercentileToGrade(size)
                ),
                versatility: Math.round(
                    scalePercentileToGrade(versatility)
                ),
                summaryStats: {
                    passingYards:
                        player.careerTotals.passing.yards,
                    passingTD:
                        player.careerTotals.passing.touchdowns,
                    rushingYards:
                        player.careerTotals.rushing.yards,
                    rushingTD:
                        player.careerTotals.rushing.touchdowns,
                    receptions:
                        player.careerTotals.receiving.receptions,
                    receivingYards:
                        player.careerTotals.receiving.yards,
                    receivingTD:
                        player.careerTotals.receiving.touchdowns,
                    fieldGoalsMade:
                        player.careerTotals.kicking.fieldGoalsMade,
                    fieldGoalAttempts:
                        player.careerTotals.kicking.fieldGoalAttempts,
                    extraPointsMade:
                        player.careerTotals.kicking.extraPointsMade,
                    extraPointAttempts:
                        player.careerTotals.kicking.extraPointAttempts,
                    longFieldGoal:
                        player.careerTotals.kicking.long
                },
                draftOutcome: actualDraft
            });
        }
    }

    scored.sort(
        (a, b) =>
            b.grade - a.grade ||
            a.name.localeCompare(b.name)
    );

    return {
        prospectClass,
        cutoffYear,
        endWeek,
        currentYear,
        draftYear,
        generatedAt: new Date().toISOString(),
        modelVersion: MODEL_VERSION,
        prospects: scored.map((player, index) => ({
            ...player,
            rank: index + 1
        }))
    };
};
