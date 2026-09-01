<script>
    import { gotoManager } from '$lib/utils/helper';
    import DataTable, {
        Head,
        Body,
        Row,
        Cell
    } from '@smui/data-table';

    import { Icon } from '@smui/icon-button';
    import RosterRow from "./RosterRow.svelte";

    export let roster;
    export let leagueTeamManagers;
    export let startersAndReserve;
    export let players;
    export let rosterPositions;
    export let division;
    export let expanded;
    export let scores;

    $: team =
        leagueTeamManagers
            .teamManagersMap[
                leagueTeamManagers.currentSeason
            ][roster.roster_id].team;

    let i = 0;

    const digestData = (
        passedPlayers,
        rawPlayers,
        startingPlayers = false,
        reserve = false
    ) => {
        let digestedRoster = [];

        for (const singlePlayer of rawPlayers) {

            if (
                !startingPlayers &&
                !reserve &&
                startersAndReserve.includes(singlePlayer)
            ) {
                continue;
            }

            let player = {};
            let slot = "BN";

            if (startingPlayers) {
                slot =
                    rosterPositions[i] == "WRRB_FLEX"
                        ? "WR/RB"
                        : rosterPositions[i];
            }

            if (singlePlayer == "0") {
                player = {
                    name: "Empty",
                    poss: null,
                    team: null,
                    avatar: null,
                    slot
                };

                i++;
                digestedRoster.push(player);
                continue;
            }

            let injury = null;

            switch (passedPlayers[singlePlayer].is) {
                case "Questionable":
                    injury = "Q";
                    break;

                case "Out":
                    injury = "OUT";
                    break;

                case "PUP":
                    injury = "PUP";
                    break;

                case "IR":
                    injury = "IR";
                    break;

                default:
                    break;
            }

            player = {
                name:
                    `${passedPlayers[singlePlayer].fn} ` +
                    `${passedPlayers[singlePlayer].ln}` +
                    `${injury
                        ? `<span class="injury ${injury}">${injury}</span>`
                        : ""}`,

                nickname:
                    roster.metadata &&
                    roster.metadata[`p_nick_${singlePlayer}`]
                        ? roster.metadata[`p_nick_${singlePlayer}`]
                        : null,

                poss: passedPlayers[singlePlayer].pos,
                team: passedPlayers[singlePlayer].t,

                avatar:
                    passedPlayers[singlePlayer].pos == "DEF"
                        ? `background-image: url(https://sleepercdn.com/images/team_logos/nfl/${singlePlayer.toLowerCase()}.png)`
                        : `background-image: url(https://sleepercdn.com/content/nfl/players/thumb/${singlePlayer}.jpg), url(https://sleepercdn.com/images/v2/icons/player_default.webp)`,

                slot
            };

            i++;
            digestedRoster.push(player);
        }

        i = 0;

        return digestedRoster;
    };

    $: finalStarters =
        digestData(
            players,
            roster.starters,
            true
        );

    let finalBench = [];

    $: if (roster.players) {
        finalBench =
            digestData(
                players,
                roster.players
            );
    }

    let finalIR = null;

    if (roster.reserve) {
        finalIR =
            digestData(
                players,
                roster.reserve,
                false,
                true
            );
    }

    const buildRecord = newRoster => {
        const innerRecord = [];

        if (
            !newRoster.metadata ||
            !newRoster.metadata.record
        ) {
            return innerRecord;
        }

        for (const c of newRoster.metadata.record) {
            switch (c) {
                case "W":
                    innerRecord.push("green");
                    break;

                case "L":
                    innerRecord.push("red");
                    break;

                default:
                    innerRecord.push("gray");
                    break;
            }
        }

        return innerRecord;
    };

    $: record = buildRecord(roster);

    let selected = "0px";
    let status = "minimized";

    const toggleSelected = () => {
        selected =
            selected == "0px"
                ? calcHeight() + "px"
                : "0px";

        status =
            status == "minimized"
                ? "expanded"
                : "minimized";
    };

    let innerWidth;

    const calcHeight = () => {
        const multiplier = 52;

        const benchLength =
            finalBench.length * multiplier + 53;

        let irLength = 0;

        if (finalIR) {
            irLength =
                finalIR.length * multiplier + 52;
        }

        return benchLength + irLength;
    };

    $: {
        selected =
            expanded
                ? calcHeight() + "px"
                : "0px";

        status =
            expanded
                ? "expanded"
                : "minimized";
    }

    const interpolateScoreColor = (
        score,
        invert = false,
        alpha = 0.18
    ) => {
        let value = Math.max(
            0,
            Math.min(100, score ?? 0)
        );

        if (invert) {
            value = 100 - value;
        }

        const stops = [
            {
                value: 0,
                r: 220,
                g: 70,
                b: 70
            },
            {
                value: 25,
                r: 235,
                g: 145,
                b: 55
            },
            {
                value: 50,
                r: 235,
                g: 210,
                b: 70
            },
            {
                value: 75,
                r: 85,
                g: 175,
                b: 95
            },
            {
                value: 100,
                r: 75,
                g: 115,
                b: 220
            }
        ];

        let lower = stops[0];
        let upper = stops[stops.length - 1];

        for (let i = 0; i < stops.length - 1; i++) {
            if (
                value >= stops[i].value &&
                value <= stops[i + 1].value
            ) {
                lower = stops[i];
                upper = stops[i + 1];
                break;
            }
        }

        const range =
            upper.value - lower.value;

        const t =
            range === 0
                ? 0
                : (value - lower.value) /
                  range;

        const r = Math.round(
            lower.r +
            (upper.r - lower.r) * t
        );

        const g = Math.round(
            lower.g +
            (upper.g - lower.g) * t
        );

        const b = Math.round(
            lower.b +
            (upper.b - lower.b) * t
        );

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const getScoreColor = (
        score,
        invert = false
    ) => {
        return interpolateScoreColor(
            score,
            invert,
            0.18
        );
    };

    const getScoreBorderColor = (
        score,
        invert = false
    ) => {
        return interpolateScoreColor(
            score,
            invert,
            0.65
        );
    };
</script>

<svelte:window bind:innerWidth={innerWidth} />

<style>
    h5 {
        text-align: center;
        margin: 0.2em auto;
    }

    .teamAvatar {
        vertical-align: middle;
        border-radius: 50%;
        height: 40px;
        border: 0.25px solid #777;
    }

    .team {
        margin: 4px 10px 10px;
    }

    .teamHeader {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 10px;
    }

    .teamIdentity {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-grow: 1;
        min-width: 0;
        cursor: pointer;
    }

    .teamName {
        font-size: 1.15em;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .scoreGroup {
        display: flex;
        align-items: flex-start;
        gap: 5px;
        margin-left: auto;
    }

    .scoreSlot {
        width: 34px;
        text-align: center;
    }

    .scoreCircle {
        display: inline-flex;
        height: 27px;
        width: 27px;
        justify-content: center;
        align-items: center;
        border-radius: 50%;
        border: 1px solid;
        box-sizing: border-box;
        font-size: 0.68em;
        font-weight: 700;
        color: var(--g555);
    }

    .scoreLabel {
        font-size: 0.5em;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: var(--g555);
        line-height: 1em;
        margin-top: 2px;
    }

    :global(.clickable) {
        cursor: pointer;
    }

    :global(.teamInner) {
        box-shadow:
            0px 3px 3px -2px var(--boxShadowOne),
            0px 3px 4px 0px var(--boxShadowTwo),
            0px 1px 8px 0px var(--boxShadowThree);

        display: block;
        margin: 0 auto;
    }

    .rosterBench {
        overflow: hidden;
        width: 100%;
        display: block;
        transition: max-height 0.7s ease-in-out;
    }

    :global(.r_1) {
        text-align: center;
        background-color: var(--r1);
    }

    :global(.r_2) {
        text-align: center;
        background-color: var(--r2);
    }

    :global(.r_3) {
        text-align: center;
        background-color: var(--r3);
    }

    .record {
        width: 100%;
        margin-bottom: 5px;
        display: flex;
        justify-content: space-around;
    }

    .result {
        width: 11px;
    }

    h5 {
        font-size: 1.2em;
        text-align: center;
    }

    @media (max-width: 500px) {
        .team {
            font-size: 0.9em;
        }

        .result {
            width: 9px;
        }

        h5 {
            font-size: 1.1em;
        }

        .scoreSlot {
            width: 29px;
        }

        .scoreCircle {
            height: 23px;
            width: 23px;
            font-size: 0.58em;
        }

        .scoreLabel {
            font-size: 0.44em;
        }

        .teamName {
            font-size: 1em;
        }
    }

    @media (max-width: 340px) {
        h5 {
            font-size: 1em;
        }

        .scoreGroup {
            gap: 2px;
        }

        .scoreSlot {
            width: 25px;
        }

        .scoreCircle {
            height: 20px;
            width: 20px;
            font-size: 0.5em;
        }

        .scoreLabel {
            font-size: 0.4em;
        }
    }

    @media (max-width: 400px) {
        .team {
            margin: 4px auto 10px;
        }
    }

    :global(.icon) {
        vertical-align: middle;
    }

    .italic {
        color: #aaa;
        font-style: italic;
    }

    :global(.interactive) {
        vertical-align: middle;
        cursor: pointer;
    }

    :global(.bench) {
        background-color: var(--ir);
    }
</style>

<div class="team">

    <DataTable
        class="teamInner"
        table$aria-label="Team Name"
        style="
            width:
            {innerWidth * 0.95 > 380
                ? 380
                : innerWidth * 0.95}px;
        "
    >

        <Head>
            <Row>
                <Cell
                    colspan=4
                    class="r_{division}"
                >

                    <div class="teamHeader">

                        <div
                            class="teamIdentity"
                            onclick={() =>
                                gotoManager({
                                    leagueTeamManagers,
                                    rosterID:
                                        roster.roster_id
                                })
                            }
                        >
                            <img
                                alt="team avatar"
                                class="teamAvatar"
                                src="{team
                                    ? team.avatar
                                    : 'https://sleepercdn.com/images/v2/icons/player_default.webp'}"
                            />

                            <div class="teamName">
                                {team?.name
                                    ? team.name
                                    : 'No Manager'}
                            </div>
                        </div>

                        {#if scores}
                            <div class="scoreGroup">

                                <div class="scoreSlot">
                                    <div
                                        class="scoreCircle"
                                        title="Win Now: {scores.winNow}"
                                        style="
                                            background-color:
                                            {getScoreColor(
                                                scores.winNow
                                            )};

                                            border-color:
                                            {getScoreBorderColor(
                                                scores.winNow
                                            )};
                                        "
                                    >
                                        {scores.winNow}
                                    </div>

                                    <div class="scoreLabel">
                                        WN
                                    </div>
                                </div>

                                <div class="scoreSlot">
                                    <div
                                        class="scoreCircle"
                                        title="Dynasty: {scores.dynasty}"
                                        style="
                                            background-color:
                                            {getScoreColor(
                                                scores.dynasty
                                            )};

                                            border-color:
                                            {getScoreBorderColor(
                                                scores.dynasty
                                            )};
                                        "
                                    >
                                        {scores.dynasty}
                                    </div>

                                    <div class="scoreLabel">
                                        DYN
                                    </div>
                                </div>

                                <div class="scoreSlot">
                                    <div
                                        class="scoreCircle"
                                        title="Rebuild: {scores.rebuild}"
                                        style="
                                            background-color:
                                            {getScoreColor(
                                                scores.rebuild,
                                                true
                                            )};

                                            border-color:
                                            {getScoreBorderColor(
                                                scores.rebuild,
                                                true
                                            )};
                                        "
                                    >
                                        {scores.rebuild}
                                    </div>

                                    <div class="scoreLabel">
                                        REB
                                    </div>
                                </div>

                            </div>
                        {/if}

                    </div>

                    <div class="record">
                        {#each record as result}
                            <img
                                alt="match result"
                                class="result"
                                src="/{result}.png"
                            />
                        {/each}
                    </div>

                </Cell>
            </Row>
        </Head>

        <Body>

            {#each finalStarters as starter}
                <RosterRow player={starter} />
            {/each}

            <Row
                class="interactive"
                onclick={toggleSelected}
            >
                <Cell
                    colspan=4
                    class="{division}"
                >
                    <h5>
                        <Icon class="material-icons icon">
                            king_bed
                        </Icon>

                        Bench

                        <span class="italic">
                            ({status})
                        </span>
                    </h5>
                </Cell>
            </Row>

        </Body>

    </DataTable>

    <div
        class="rosterBench"
        style="max-height: {selected}"
    >

        <DataTable
            class="teamInner"
            style="width: 380px"
        >

            <Body class="bench">

                {#each finalBench as bench}
                    <RosterRow player={bench} />
                {/each}

                {#if finalIR}

                    <Row>
                        <Cell colspan=4>
                            <h5>
                                <Icon class="material-icons icon">
                                    healing
                                </Icon>

                                Injured Reserve
                            </h5>
                        </Cell>
                    </Row>

                    {#each finalIR as ir}
                        <RosterRow player={ir} />
                    {/each}

                {/if}

                <Row
                    class="interactive"
                    onclick={toggleSelected}
                >
                    <Cell
                        colspan=4
                        class="{division}"
                    >
                        <h5>
                            <Icon class="material-icons icon">
                                close_fullscreen
                            </Icon>

                            Close Bench
                        </h5>
                    </Cell>
                </Row>

            </Body>

        </DataTable>

    </div>

</div>
