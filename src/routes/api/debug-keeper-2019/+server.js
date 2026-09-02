import { json } from '@sveltejs/kit';

const LEAGUE_ID_2019 = '407807711988695040';
const MAX_TRANSACTION_ROUND = 18;

const normalizeTimestamp = value => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return null;

    // Sleeper normally returns milliseconds. Preserve both formats safely.
    return number < 1e12 ? number * 1000 : number;
};

const transactionTimestamp = transaction =>
    normalizeTimestamp(
        transaction?.status_updated ??
        transaction?.created
    );

const compareTimestampAscending = (a, b) =>
    Number(a?.timestamp || 0) - Number(b?.timestamp || 0);

export async function GET({ fetch }) {
    /*
        PURPOSE

        Diagnose why players who are already rostered in 2019 Week 1 can
        fall through Keeper Tracker with "Acquisition unknown".

        This endpoint does NOT modify anything. It gathers:
          1. Full completed 2019 draft data
          2. Every 2019 transaction bucket 0-18
          3. Week 1 matchup/roster snapshot
          4. A per-player acquisition-evidence report for every Week 1 player

        A player is flagged "noPreWeekAcquisitionEvidence" when he is on a
        Week 1 roster but we cannot find a true draft acquisition or an add/
        trade acquisition that occurred before the Week 1 snapshot.

        Raw evidence is returned so we can determine whether the source data
        is incomplete, misordered, keeper-related, or simply lacks an
        acquisition record.
    */

    const [
        draftListResponse,
        week1Response
    ] = await Promise.all([
        fetch(
            `https://api.sleeper.app/v1/league/${LEAGUE_ID_2019}/drafts`
        ),
        fetch(
            `https://api.sleeper.app/v1/league/${LEAGUE_ID_2019}/matchups/1`
        )
    ]);

    const draftList = draftListResponse.ok
        ? await draftListResponse.json()
        : [];

    const week1Rows = week1Response.ok
        ? await week1Response.json()
        : [];

    const completedDrafts = Array.isArray(draftList)
        ? draftList.filter(draft => draft?.status === 'complete')
        : [];

    const draftPackages = [];

    for (const draftInfo of completedDrafts) {
        const draftID = draftInfo?.draft_id;
        if (!draftID) continue;

        try {
            const [infoResponse, picksResponse] = await Promise.all([
                fetch(`https://api.sleeper.app/v1/draft/${draftID}`),
                fetch(`https://api.sleeper.app/v1/draft/${draftID}/picks`)
            ]);

            const info = infoResponse.ok
                ? await infoResponse.json()
                : draftInfo;

            const picks = picksResponse.ok
                ? await picksResponse.json()
                : [];

            draftPackages.push({
                draftID: String(draftID),
                info,
                startTime: normalizeTimestamp(
                    info?.start_time ?? draftInfo?.start_time
                ),
                picks: Array.isArray(picks) ? picks : []
            });
        } catch (error) {
            draftPackages.push({
                draftID: String(draftID),
                error: String(error),
                info: draftInfo,
                startTime: normalizeTimestamp(draftInfo?.start_time),
                picks: []
            });
        }
    }

    const draftStartTimes = draftPackages
        .map(draft => Number(draft.startTime))
        .filter(Number.isFinite);

    const firstDraftStartTime = draftStartTimes.length
        ? Math.min(...draftStartTimes)
        : null;

    const transactionRequests = [];

    for (let round = 0; round <= MAX_TRANSACTION_ROUND; round++) {
        transactionRequests.push(
            fetch(
                `https://api.sleeper.app/v1/league/${LEAGUE_ID_2019}/transactions/${round}`
            )
                .then(async response => ({
                    round,
                    ok: response.ok,
                    rows: response.ok ? await response.json() : []
                }))
                .catch(error => ({
                    round,
                    ok: false,
                    error: String(error),
                    rows: []
                }))
        );
    }

    const transactionResults = await Promise.all(transactionRequests);

    const transactions = [];

    for (const result of transactionResults) {
        if (!Array.isArray(result.rows)) continue;

        for (const transaction of result.rows) {
            if (transaction?.status === 'failed') continue;

            transactions.push({
                round: Number(result.round),
                timestamp: transactionTimestamp(transaction),
                transaction
            });
        }
    }

    transactions.sort(compareTimestampAscending);

    const week1Players = [];

    for (const row of Array.isArray(week1Rows) ? week1Rows : []) {
        const rosterID = Number(row?.roster_id);
        if (!Number.isFinite(rosterID)) continue;

        const players = Array.isArray(row?.players)
            ? row.players.map(String)
            : [];

        for (const playerID of players) {
            week1Players.push({
                playerID,
                rosterID
            });
        }
    }

    const playerReports = [];

    for (const week1Player of week1Players) {
        const { playerID, rosterID } = week1Player;

        const draftEvidence = [];

        for (const draft of draftPackages) {
            for (const pick of draft.picks) {
                if (String(pick?.player_id) !== playerID) continue;

                draftEvidence.push({
                    draftID: draft.draftID,
                    draftStartTime: draft.startTime,
                    rosterID: Number(pick?.roster_id),
                    round: Number(pick?.round),
                    pickNo: Number(
                        pick?.pick_no ??
                        pick?.pick_number
                    ),
                    isKeeper: pick?.is_keeper ?? null,
                    metadata: pick?.metadata ?? null,
                    rawPick: pick
                });
            }
        }

        const transactionEvidence = [];

        for (const entry of transactions) {
            const tx = entry.transaction;
            const adds = tx?.adds || {};
            const drops = tx?.drops || {};

            const wasAdded =
                Object.prototype.hasOwnProperty.call(adds, playerID);

            const wasDropped =
                Object.prototype.hasOwnProperty.call(drops, playerID);

            if (!wasAdded && !wasDropped) continue;

            transactionEvidence.push({
                round: entry.round,
                timestamp: entry.timestamp,
                type: tx?.type ?? null,
                status: tx?.status ?? null,
                addedToRosterID: wasAdded
                    ? Number(adds[playerID])
                    : null,
                droppedFromRosterID: wasDropped
                    ? Number(drops[playerID])
                    : null,
                transactionID: tx?.transaction_id ?? null,
                rawTransaction: tx
            });
        }

        /*
            The Keeper Tracker should know the Week 1 acquisition if:
              - a true draft pick placed the player on this roster, OR
              - a transaction added him to this roster before Week 1.

            For this diagnostic, keeper rows are reported separately rather
            than automatically counted as true acquisitions.
        */
        const trueDraftEvidence = draftEvidence.filter(
            evidence =>
                evidence.rosterID === rosterID &&
                evidence.isKeeper !== true
        );

        const keeperEvidence = draftEvidence.filter(
            evidence =>
                evidence.rosterID === rosterID &&
                evidence.isKeeper === true
        );

        const addEvidence = transactionEvidence.filter(
            evidence =>
                evidence.addedToRosterID === rosterID
        );

        const releaseEvidence = transactionEvidence.filter(
            evidence =>
                evidence.droppedFromRosterID === rosterID
        );

        const latestEvidenceTimestamp = [
            ...trueDraftEvidence.map(item => item.draftStartTime),
            ...addEvidence.map(item => item.timestamp)
        ]
            .map(Number)
            .filter(Number.isFinite)
            .sort((a, b) => b - a)[0] ?? null;

        playerReports.push({
            playerID,
            rosterID,
            name:
                draftEvidence
                    .map(item =>
                        [
                            item?.metadata?.first_name,
                            item?.metadata?.last_name
                        ]
                            .filter(Boolean)
                            .join(' ')
                    )
                    .find(Boolean) || null,
            evidenceSummary: {
                trueDraftCount: trueDraftEvidence.length,
                keeperRowCount: keeperEvidence.length,
                addCount: addEvidence.length,
                releaseCount: releaseEvidence.length,
                latestAcquisitionEvidenceTimestamp: latestEvidenceTimestamp,
                noPreWeekAcquisitionEvidence:
                    trueDraftEvidence.length === 0 &&
                    addEvidence.length === 0
            },
            trueDraftEvidence,
            keeperEvidence,
            addEvidence,
            releaseEvidence,
            allDraftEvidence: draftEvidence,
            allTransactionEvidence: transactionEvidence
        });
    }

    const unknownCandidates = playerReports
        .filter(
            report =>
                report.evidenceSummary.noPreWeekAcquisitionEvidence
        )
        .sort((a, b) => {
            if (a.rosterID !== b.rosterID) {
                return a.rosterID - b.rosterID;
            }

            return String(a.playerID).localeCompare(
                String(b.playerID)
            );
        });

    return json({
        diagnostic: 'USCCFFL 2019 Week 1 acquisition evidence',
        leagueID: LEAGUE_ID_2019,
        firstDraftStartTime,
        counts: {
            completedDrafts: completedDrafts.length,
            draftPackages: draftPackages.length,
            draftPicks: draftPackages.reduce(
                (sum, draft) =>
                    sum + draft.picks.length,
                0
            ),
            transactions: transactions.length,
            week1RosterPlayers: week1Players.length,
            unknownCandidates: unknownCandidates.length
        },

        /*
            Start here. These are the players most likely to become
            "Acquisition unknown" in the tracker.
        */
        unknownCandidates,

        /*
            Full evidence is included below in case an apparently known
            player is still being mishandled by ordering or ownership logic.
        */
        allWeek1PlayerReports: playerReports,

        raw: {
            draftList,
            draftPackages,
            transactionBuckets: transactionResults.map(result => ({
                round: result.round,
                ok: result.ok,
                error: result.error ?? null,
                count: Array.isArray(result.rows)
                    ? result.rows.length
                    : 0
            })),
            week1Rows
        }
    });
}
