import { archivedFetch } from '$lib/server/archiveDb';
import { sleeperGet } from '$lib/server/sleeperArchive';

const BASE_RATING = 1500;
const K_FACTOR = 24;
const MAX_GAME_CHANGE = 32;
const PROJECTION_BLEND = 0.35;
const ELO_BLEND = 1 - PROJECTION_BLEND;
const DERIVED_CACHE_TTL_MS = 30 * 60 * 1000;

const LEAGUES = [
  { season: 2019, leagueId: '407807711988695040' },
  { season: 2020, leagueId: '517432431025664000' },
  { season: 2021, leagueId: '650120255582101504' },
  { season: 2022, leagueId: '784485837789319168' },
  { season: 2023, leagueId: '917281268096901120' },
  { season: 2024, leagueId: '1050136982275383296' },
  { season: 2025, leagueId: '1180214242271457280' },
  { season: 2026, leagueId: '1312126115816415232' }
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const round = (v, d = 1) => { const f = 10 ** d; return Math.round(v * f) / f; };
const historicalSeason = season => Number(season) < new Date().getUTCFullYear();

const fetchJson = async (url, { season = null, type = 'power-rating', week = null, notFoundValue } = {}) => {
  const isFinal = Number.isFinite(Number(season)) && historicalSeason(season);

  return sleeperGet(url, {
    ttlMs: isFinal ? null : 15 * 60 * 1000,
    isFinal,
    metadata: {
      source: 'owner-power-rating-v1.1',
      type,
      ...(season == null ? {} : { season: Number(season) }),
      ...(week == null ? {} : { week: Number(week) })
    },
    notFoundValue
  });
};

const safeFetchJson = async (url, fallback = null, options = {}) => {
  try { return await fetchJson(url, options); } catch { return fallback; }
};

const runWithConcurrency = async (jobs, limit = 12) => {
  const results = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= jobs.length) return;
      results[i] = await jobs[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, () => worker()));
  return results;
};

const eloExpected = (a, b) => 1 / (1 + 10 ** ((b - a) / 400));
const projectionExpected = margin => 1 / (1 + Math.exp(-margin / 25));

const matchupExpected = ({ ratingA, ratingB, projectionA, projectionB }) => {
  const elo = eloExpected(ratingA, ratingB);
  if (!Number.isFinite(projectionA) || !Number.isFinite(projectionB)) {
    return { probability: elo, eloProbability: elo, projectionProbability: null, projectedMargin: null };
  }
  const projectedMargin = projectionA - projectionB;
  const projected = projectionExpected(projectedMargin);
  return {
    probability: ELO_BLEND * elo + PROJECTION_BLEND * projected,
    eloProbability: elo,
    projectionProbability: projected,
    projectedMargin
  };
};

const scoreFromResult = (a, b) => a > b ? 1 : a < b ? 0 : 0.5;

const gameModifier = ({ result, actualMargin, projectedMargin, pointsA, projectionA }) => {
  const direction = result === 0.5 ? 0 : result === 1 ? 1 : -1;
  const blowout = 1 + 0.15 * Math.tanh(Math.abs(actualMargin) / 35);
  let marginVsExpected = 1;
  if (Number.isFinite(projectedMargin)) {
    const residual = direction * (actualMargin - projectedMargin);
    marginVsExpected = 1 + 0.22 * Math.tanh(residual / 30);
  }
  let ownProjection = 1;
  if (direction !== 0 && Number.isFinite(projectionA)) {
    const execution = direction * (pointsA - projectionA);
    ownProjection = 1 + 0.08 * Math.tanh(execution / 25);
  }
  return clamp(blowout * marginVsExpected * ownProjection, 0.65, 1.45);
};

const normalizeProjectionRows = rows => new Map(
  (Array.isArray(rows) ? rows : [])
    .filter(r => r?.player_id)
    .map(r => [String(r.player_id), r.stats || {}])
);

const projectedPlayerPoints = (stats, scoring) => {
  let points = 0;
  for (const [key, multiplier] of Object.entries(scoring || {})) {
    const value = Number(stats?.[key]);
    const weight = Number(multiplier);
    if (Number.isFinite(value) && Number.isFinite(weight)) points += value * weight;
  }
  return points;
};

const projectedTeamPoints = ({ starters, projectionMap, scoringSettings }) => {
  if (!Array.isArray(starters) || !starters.length || !projectionMap?.size) return null;
  let total = 0;
  let covered = 0;
  for (const id of starters) {
    const stats = projectionMap.get(String(id));
    if (!stats) continue;
    total += projectedPlayerPoints(stats, scoringSettings);
    covered += 1;
  }
  if (covered < Math.max(1, Math.ceil(starters.length * 0.65))) return null;
  return round(total, 2);
};

const displayNameForUser = user => user?.display_name || user?.username || user?.metadata?.team_name || 'Unknown Owner';

const loadSeasonContext = async ({ season, leagueId }) => {
  const base = `https://api.sleeper.app/v1/league/${leagueId}`;
  const common = { season };
  const [league, users, rosters] = await Promise.all([
    fetchJson(base, { ...common, type: 'league' }),
    fetchJson(`${base}/users`, { ...common, type: 'users' }),
    fetchJson(`${base}/rosters`, { ...common, type: 'rosters' })
  ]);
  const usersById = new Map((users || []).map(u => [String(u.user_id), u]));
  const ownerByRoster = new Map();
  for (const roster of rosters || []) {
    if (!roster?.owner_id) continue;
    const ownerId = String(roster.owner_id);
    const user = usersById.get(ownerId);
    ownerByRoster.set(Number(roster.roster_id), {
      ownerId,
      displayName: displayNameForUser(user),
      avatar: user?.avatar || null
    });
  }
  return { season, leagueId, ownerByRoster, scoringSettings: league?.scoring_settings || {} };
};

const projectionUrls = (season, week) => [
  `https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular`,
  `https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=post`
];

const loadWeek = async (context, week) => {
  const matchupPromise = safeFetchJson(
    `https://api.sleeper.app/v1/league/${context.leagueId}/matchups/${week}`,
    [],
    { season: context.season, week, type: 'matchups', notFoundValue: [] }
  );
  const projectionPromise = (async () => {
    for (const url of projectionUrls(context.season, week)) {
      const rows = await safeFetchJson(
        url,
        null,
        { season: context.season, week, type: 'projection', notFoundValue: [] }
      );
      if (Array.isArray(rows) && rows.length) return rows;
    }
    return [];
  })();
  const [matchups, projectionRows] = await Promise.all([matchupPromise, projectionPromise]);
  return { week, matchups: Array.isArray(matchups) ? matchups : [], projectionMap: normalizeProjectionRows(projectionRows) };
};

const ownerState = (states, owner) => {
  if (!states.has(owner.ownerId)) {
    states.set(owner.ownerId, {
      ownerId: owner.ownerId, name: owner.displayName, avatar: owner.avatar,
      rating: BASE_RATING, peak: BASE_RATING, low: BASE_RATING,
      games: 0, wins: 0, losses: 0, ties: 0, firstSeason: null, lastSeason: null,
      weeksAtOne: 0, history: [], gameLog: []
    });
  }
  const state = states.get(owner.ownerId);
  if (owner.displayName) state.name = owner.displayName;
  if (owner.avatar) state.avatar = owner.avatar;
  return state;
};

const matchupPairs = matchups => {
  const groups = new Map();
  for (const row of matchups || []) {
    if (row?.matchup_id == null) continue;
    const key = String(row.matchup_id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].filter(([, rows]) => rows.length === 2).map(([matchupId, rows]) => ({ matchupId, rows }));
};

const rankingSnapshot = states => [...states.values()].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));

const processGame = ({ context, weekData, pair, states, games }) => {
  const [rowA, rowB] = pair.rows;
  const ownerA = context.ownerByRoster.get(Number(rowA.roster_id));
  const ownerB = context.ownerByRoster.get(Number(rowB.roster_id));
  if (!ownerA || !ownerB || ownerA.ownerId === ownerB.ownerId) return false;

  const pointsA = Number(rowA.points);
  const pointsB = Number(rowB.points);
  if (!Number.isFinite(pointsA) || !Number.isFinite(pointsB) || (pointsA === 0 && pointsB === 0)) return false;

  const stateA = ownerState(states, ownerA);
  const stateB = ownerState(states, ownerB);
  const beforeA = stateA.rating;
  const beforeB = stateB.rating;

  const projectionA = projectedTeamPoints({ starters: rowA.starters, projectionMap: weekData.projectionMap, scoringSettings: context.scoringSettings });
  const projectionB = projectedTeamPoints({ starters: rowB.starters, projectionMap: weekData.projectionMap, scoringSettings: context.scoringSettings });
  const expected = matchupExpected({ ratingA: beforeA, ratingB: beforeB, projectionA, projectionB });
  const resultA = scoreFromResult(pointsA, pointsB);
  const actualMargin = pointsA - pointsB;
  const modifier = gameModifier({ result: resultA, actualMargin, projectedMargin: expected.projectedMargin, pointsA, projectionA });
  const changeA = clamp(K_FACTOR * (resultA - expected.probability) * modifier, -MAX_GAME_CHANGE, MAX_GAME_CHANGE);
  const changeB = -changeA;

  stateA.rating = round(beforeA + changeA, 3);
  stateB.rating = round(beforeB + changeB, 3);

  for (const [state, result] of [[stateA, resultA], [stateB, 1 - resultA]]) {
    state.games += 1;
    if (result === 1) state.wins += 1; else if (result === 0) state.losses += 1; else state.ties += 1;
    state.firstSeason = state.firstSeason == null ? context.season : Math.min(state.firstSeason, context.season);
    state.lastSeason = state.lastSeason == null ? context.season : Math.max(state.lastSeason, context.season);
    state.peak = Math.max(state.peak, state.rating);
    state.low = Math.min(state.low, state.rating);
  }

  const game = {
    id: `${context.season}-${weekData.week}-${pair.matchupId}`,
    season: context.season, week: weekData.week,
    ownerA: stateA.ownerId, ownerAName: stateA.name, ownerB: stateB.ownerId, ownerBName: stateB.name,
    pointsA: round(pointsA, 2), pointsB: round(pointsB, 2),
    projectionA: Number.isFinite(projectionA) ? projectionA : null,
    projectionB: Number.isFinite(projectionB) ? projectionB : null,
    projectedMargin: Number.isFinite(expected.projectedMargin) ? round(expected.projectedMargin, 2) : null,
    actualMargin: round(actualMargin, 2), expectedA: round(expected.probability * 100, 1),
    beforeA: round(beforeA, 1), beforeB: round(beforeB, 1),
    afterA: round(stateA.rating, 1), afterB: round(stateB.rating, 1),
    changeA: round(changeA, 1), changeB: round(changeB, 1), modifier: round(modifier, 3),
    winner: resultA === 0.5 ? null : resultA === 1 ? stateA.ownerId : stateB.ownerId
  };
  games.push(game);

  stateA.gameLog.push({ gameId: game.id, season: game.season, week: game.week, opponent: stateB.name, pointsFor: game.pointsA, pointsAgainst: game.pointsB, projectionFor: game.projectionA, projectionAgainst: game.projectionB, expectedWinPct: game.expectedA, ratingBefore: game.beforeA, ratingAfter: game.afterA, change: game.changeA, result: resultA === 1 ? 'W' : resultA === 0 ? 'L' : 'T' });
  stateB.gameLog.push({ gameId: game.id, season: game.season, week: game.week, opponent: stateA.name, pointsFor: game.pointsB, pointsAgainst: game.pointsA, projectionFor: game.projectionB, projectionAgainst: game.projectionA, expectedWinPct: round((1 - expected.probability) * 100, 1), ratingBefore: game.beforeB, ratingAfter: game.afterB, change: game.changeB, result: resultA === 0 ? 'W' : resultA === 1 ? 'L' : 'T' });

  return true;
};

const computeOwnerPowerRatings = async () => {
  const contexts = await runWithConcurrency(LEAGUES.map(info => () => loadSeasonContext(info)), 8);
  const jobs = [];
  for (const context of contexts) for (let week = 1; week <= 18; week++) jobs.push(async () => ({ context, weekData: await loadWeek(context, week) }));
  const weeks = await runWithConcurrency(jobs, 14);
  weeks.sort((a, b) => a.context.season - b.context.season || a.weekData.week - b.weekData.week);

  const states = new Map();
  const games = [];
  const timeline = [];

  for (const { context, weekData } of weeks) {
    const pairs = matchupPairs(weekData.matchups);
    if (!pairs.length) continue;

    let processedGames = 0;
    for (const pair of pairs) {
      if (processGame({ context, weekData, pair, states, games })) processedGames += 1;
    }

    if (!processedGames) continue;

    const ranking = rankingSnapshot(states);
    ranking.forEach((owner, index) => {
      if (index === 0) owner.weeksAtOne += 1;
      owner.history.push({ season: context.season, week: weekData.week, rating: round(owner.rating, 1), rank: index + 1 });
    });
    timeline.push({ season: context.season, week: weekData.week, owners: ranking.map((o, i) => ({ ownerId: o.ownerId, name: o.name, rating: round(o.rating, 1), rank: i + 1 })) });
  }

  const owners = rankingSnapshot(states).map((o, i) => ({
    ownerId: o.ownerId, name: o.name, avatar: o.avatar, rank: i + 1,
    rating: round(o.rating, 1), peak: round(o.peak, 1), low: round(o.low, 1),
    games: o.games, wins: o.wins, losses: o.losses, ties: o.ties,
    winPct: o.games ? round(((o.wins + o.ties * 0.5) / o.games) * 100, 1) : 0,
    firstSeason: o.firstSeason, lastSeason: o.lastSeason, weeksAtOne: o.weeksAtOne,
    history: o.history, gameLog: o.gameLog
  }));

  const biggestUpsets = [...games].filter(g => g.winner).map(g => {
    const winnerIsA = g.winner === g.ownerA;
    const winnerExpectedPct = winnerIsA ? g.expectedA : 100 - g.expectedA;
    return { ...g, winnerName: winnerIsA ? g.ownerAName : g.ownerBName, loserName: winnerIsA ? g.ownerBName : g.ownerAName, winnerExpectedPct: round(winnerExpectedPct, 1), winnerChange: winnerIsA ? g.changeA : g.changeB };
  }).sort((a, b) => a.winnerExpectedPct - b.winnerExpectedPct || b.winnerChange - a.winnerChange).slice(0, 10);

  const gamesWithProjection = games.filter(g => g.projectionA != null && g.projectionB != null).length;

  return {
    modelVersion: '1.1.0', generatedAt: new Date().toISOString(), baseRating: BASE_RATING,
    methodology: { kFactor: K_FACTOR, eloWeight: ELO_BLEND, projectionWeight: PROJECTION_BLEND, maxGameChange: MAX_GAME_CHANGE },
    coverage: { seasons: LEAGUES.map(x => x.season), games: games.length, gamesWithProjection, projectionCoveragePct: games.length ? round((gamesWithProjection / games.length) * 100, 1) : 0 },
    owners, timeline, games, biggestUpsets
  };
};

export const buildOwnerPowerRatings = async () => {
  const result = await archivedFetch({
    provider: 'derived',
    cacheKey: 'owner-power-rating:v1.1.0',
    endpoint: 'owner-power-rating',
    requestMeta: {
      type: 'owner-power-rating',
      modelVersion: '1.1.0'
    },
    ttlMs: DERIVED_CACHE_TTL_MS,
    isFinal: false,
    fetcher: computeOwnerPowerRatings
  });

  return result.value;
};
