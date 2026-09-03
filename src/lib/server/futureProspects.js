import { cfbdGet } from '$lib/server/cfbd';

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const MIN_GRADE = 40;
const MAX_GRADE = 99;
const REQUEST_GAP_MS = 175;

const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

const cleanKey = value =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

const toNumber = value => {
    const number = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(number) ? number : 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const safeRate = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);

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
        (MIN_GRADE + (clamp(percentile, 0, 100) / 100) * (MAX_GRADE - MIN_GRADE)) * 10
    ) / 10;

const developmentPercentile = (recruitYear, cutoffYear) => {
    if (!recruitYear) return 50;
    const years = cutoffYear - recruitYear;
    if (years <= 0) return 100;
    if (years === 1) return 95;
    if (years === 2) return 87;
    if (years === 3) return 72;
    if (years === 4) return 55;
    if (years === 5) return 40;
    return 28;
};

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
            production: 0.29,
            efficiency: 0.25,
            age: 0.16,
            pedigree: 0.14,
            competition: 0.10,
            versatility: 0.06
        };
    }

    if (position === 'RB') {
        return {
            production: 0.30,
            efficiency: 0.19,
            age: 0.17,
            pedigree: 0.13,
            competition: 0.08,
            versatility: 0.13
        };
    }

    if (position === 'TE') {
        return {
            production: 0.28,
            efficiency: 0.21,
            age: 0.18,
            pedigree: 0.14,
            competition: 0.10,
            versatility: 0.09
        };
    }

    return {
        production: 0.31,
        efficiency: 0.21,
        age: 0.18,
        pedigree: 0.14,
        competition: 0.10,
        versatility: 0.06
    };
};

const addCategoryStat = (player, category, statType, amount) => {
    const cat = cleanKey(category || 'other');
    const key = cleanKey(statType);

    if (!player.categoryStats[cat]) {
        player.categoryStats[cat] = {};
    }

    player.categoryStats[cat][key] =
        (player.categoryStats[cat][key] || 0) + amount;
};

const statFrom = (category, aliases) => {
    for (const alias of aliases) {
        const key = cleanKey(alias);
        if (category[key] !== undefined) return category[key];
    }

    return 0;
};

const calculateRawMetrics = player => {
    const passing = player.categoryStats.passing || {};
    const rushing = player.categoryStats.rushing || {};
    const receiving = player.categoryStats.receiving || {};

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

    let productionRaw = 0;
    let efficiencyRaw = 0;
    let versatilityRaw = 0;

    if (player.position === 'QB') {
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

        versatilityRaw =
            rYds / 10 +
            rTD * 5;
    } else if (player.position === 'RB') {
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
        versatilityRaw,
        summaryStats: {
            passingYards: pYds,
            passingTD: pTD,
            rushingYards: rYds,
            rushingTD: rTD,
            receptions: catches,
            receivingYards: reYds,
            receivingTD: reTD
        }
    };
};

const normalizeRecruitRating = rating => {
    const value = Number(rating);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value <= 1.2 ? value * 100 : value;
};

const formatHeight = inches => {
    const value = Number(inches);
    if (!Number.isFinite(value) || value <= 0) return null;
    return `${Math.floor(value / 12)}′${Math.round(value % 12)}″`;
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

/*
    CFBD's free access can reject a burst of simultaneous requests with 429:
    "Too many concurrent requests for this endpoint."

    These helpers intentionally request one season at a time. The small gap is
    not for quota management; it simply prevents us from hammering an endpoint
    with overlapping requests.
*/
const fetchStatsThrough = async (cutoffYear, endWeek) => {
    const rows = [];

    for (let year = cutoffYear - 3; year <= cutoffYear; year++) {
        const result = await cfbdGet('/stats/player/season', {
            year,
            seasonType: 'both',
            endWeek: year === cutoffYear ? endWeek : undefined
        });

        for (const row of result) {
            rows.push(row);
        }
        await sleep(REQUEST_GAP_MS);
    }

    return rows;
};

const fetchRecruiting = async cutoffYear => {
    const rows = [];

    for (let year = cutoffYear - 6; year <= cutoffYear; year++) {
        try {
            const result = await cfbdGet('/recruiting/players', {
                year,
                classification: 'HighSchool'
            });

            for (const row of result) {
            rows.push(row);
        }
        } catch (err) {
            /*
                Recruiting enrichment should never destroy the entire board.
                If one historical recruiting class is unavailable, players can
                still be graded using neutral pedigree/development fallbacks.
            */
            console.warn(`CFBD recruiting ${year} unavailable:`, err?.message || err);
        }

        await sleep(REQUEST_GAP_MS);
    }

    return rows;
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

export const buildProspectBoard = async ({
    cutoffYear,
    endWeek = null,
    currentYear
}) => {
    const draftYear = cutoffYear + 1;

    /*
        Run the CFBD endpoint families sequentially. The previous implementation
        used Promise.all here and inside the year loops, which generated a burst
        of 12+ simultaneous requests on the first page load.
    */
    const statRows = await fetchStatsThrough(cutoffYear, endWeek);

    const recruits = await fetchRecruiting(cutoffYear);

    let spRatings = [];
    try {
        spRatings = await cfbdGet('/ratings/sp', { year: cutoffYear });
    } catch (err) {
        console.warn('CFBD SP+ ratings unavailable:', err?.message || err);
    }

    await sleep(REQUEST_GAP_MS);

    let draftPicks = [];
    if (draftYear <= currentYear) {
        try {
            draftPicks = await cfbdGet('/draft/picks', { year: draftYear });
        } catch (err) {
            console.warn(
                `CFBD draft picks ${draftYear} unavailable:`,
                err?.message || err
            );
        }
    }

    const players = new Map();

    for (const row of statRows) {
        const position = String(row.position || '').toUpperCase();
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
                seasons: new Set()
            });
        }

        const player = players.get(id);
        player.team = row.team || player.team;
        player.conference = row.conference || player.conference;
        player.seasons.add(Number(row.season || cutoffYear));

        addCategoryStat(
            player,
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

    const spByTeam = new Map(
        (spRatings || []).map(row => [
            String(row.team || '').toLowerCase(),
            Number(row.sos ?? row.rating ?? 0)
        ])
    );

    const draftById = buildDraftMap(draftPicks);

    let rows = [...players.values()].map(player => {
        const metrics = calculateRawMetrics(player);
        const recruit = recruitById.get(player.id) || null;

        return {
            ...player,
            ...metrics,
            recruitYear: recruit?.year ?? null,
            recruitingRating: normalizeRecruitRating(recruit?.rating),
            stars: recruit?.stars ?? null,
            height: formatHeight(recruit?.height),
            weight: recruit?.weight ?? null,
            competitionRaw:
                spByTeam.get(String(player.team || '').toLowerCase()) ?? 0
        };
    });

    /*
        A board for a given cutoff season should represent players who were
        actually still playing college football in that season.

        Without this filter, the multi-year stat window also pulls in players
        whose last college season was earlier — including players already
        drafted into the NFL. Their old production is useful as history, but
        they must not remain on a later prospect board.

        We still use prior seasons to CALCULATE a player's grade; this filter
        only determines who belongs on the selected season's board.
    */
    rows = rows.filter(
        player =>
            player.productionRaw > 1 &&
            player.seasons.has(cutoffYear)
    );

    const scored = [];

    for (const position of SKILL_POSITIONS) {
        const peers = rows.filter(player => player.position === position);
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

        const competitionPct = percentileMap(
            peers,
            player => player.competitionRaw
        );

        const pedigreePeers = peers.filter(
            player => player.recruitingRating !== null
        );

        const pedigreePct = percentileMap(
            pedigreePeers,
            player => player.recruitingRating
        );

        for (const player of peers) {
            const production = productionPct.get(player.id) ?? 50;
            const efficiency = efficiencyPct.get(player.id) ?? 50;
            const versatility = versatilityPct.get(player.id) ?? 50;
            const competition = competitionPct.get(player.id) ?? 50;
            const pedigree = pedigreePct.get(player.id) ?? 50;
            const age = developmentPercentile(
                player.recruitYear,
                cutoffYear
            );

            const weights = weightsForPosition(position);

            const composite =
                production * weights.production +
                efficiency * weights.efficiency +
                age * weights.age +
                pedigree * weights.pedigree +
                competition * weights.competition +
                versatility * weights.versatility;

            const grade = scalePercentileToGrade(composite);
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
                classYear: player.recruitYear
                    ? `Class of ${player.recruitYear}`
                    : 'Class unknown',
                recruitYear: player.recruitYear,
                height: player.height,
                weight: player.weight,
                stars: player.stars,
                production: Math.round(
                    scalePercentileToGrade(production)
                ),
                efficiency: Math.round(
                    scalePercentileToGrade(efficiency)
                ),
                ageProfile: Math.round(
                    scalePercentileToGrade(age)
                ),
                pedigree: Math.round(
                    scalePercentileToGrade(pedigree)
                ),
                competition: Math.round(
                    scalePercentileToGrade(competition)
                ),
                versatility: Math.round(
                    scalePercentileToGrade(versatility)
                ),
                summaryStats: player.summaryStats,
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
        cutoffYear,
        endWeek,
        currentYear,
        draftYear,
        generatedAt: new Date().toISOString(),
        modelVersion: '0.1.3',
        prospects: scored.map((player, index) => ({
            ...player,
            rank: index + 1
        }))
    };
};
