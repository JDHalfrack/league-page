import { json } from '@sveltejs/kit';

const LEAGUE_ID_2021 = '650120255582101504';
const MAX_TRANSACTION_ROUND = 18;

export async function GET({ fetch }) {
    const draftListResponse = await fetch(
        `https://api.sleeper.app/v1/league/${LEAGUE_ID_2021}/drafts`
    );

    const draftList = draftListResponse.ok
        ? await draftListResponse.json()
        : [];

    const draftResults = [];
    let pollardPlayerID = null;

    for (const draft of Array.isArray(draftList) ? draftList : []) {
        const draftID = draft?.draft_id;
        if (!draftID) continue;

        const picksResponse = await fetch(
            `https://api.sleeper.app/v1/draft/${draftID}/picks`
        );

        const picks = picksResponse.ok
            ? await picksResponse.json()
            : [];

        for (const pick of Array.isArray(picks) ? picks : []) {
            const first = String(
                pick?.metadata?.first_name || ''
            )
                .trim()
                .toLowerCase();

            const last = String(
                pick?.metadata?.last_name || ''
            )
                .trim()
                .toLowerCase();

            const full = `${first} ${last}`.trim();

            if (
                full === 'tony pollard' ||
                last === 'pollard'
            ) {
                pollardPlayerID = String(pick.player_id);

                draftResults.push({
                    draftID,
                    draftInfo: draft,
                    pick
                });
            }
        }
    }

    const transactions = [];

    if (pollardPlayerID) {
        for (
            let round = 0;
            round <= MAX_TRANSACTION_ROUND;
            round++
        ) {
            const response = await fetch(
                `https://api.sleeper.app/v1/league/${LEAGUE_ID_2021}/transactions/${round}`
            );

            const rows = response.ok
                ? await response.json()
                : [];

            for (const transaction of Array.isArray(rows) ? rows : []) {
                const adds = transaction?.adds || {};
                const drops = transaction?.drops || {};

                if (
                    Object.prototype.hasOwnProperty.call(
                        adds,
                        pollardPlayerID
                    ) ||
                    Object.prototype.hasOwnProperty.call(
                        drops,
                        pollardPlayerID
                    )
                ) {
                    transactions.push({
                        round,
                        transaction
                    });
                }
            }
        }
    }

    return json({
        leagueID: LEAGUE_ID_2021,
        pollardPlayerID,
        draftResults,
        transactions
    });
}
