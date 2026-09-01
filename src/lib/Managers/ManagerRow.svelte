<script>
    import { goto } from "$app/navigation";
    import {
        getDatesActive,
        getRosterIDFromManagerID,
        getTeamNameFromTeamManagers
    } from "$lib/utils/helperFunctions/universalFunctions";

    export let manager, leagueTeamManagers, key;

    let retired = false;

    // manager.roster is deprecated, pages should be using managerID now
    let rosterID = manager.roster;
    let year = null;

    if (manager.managerID) {
        const dates = getDatesActive(
            leagueTeamManagers,
            manager.managerID
        );

        if (dates.end) {
            retired = true;
        }

        ({ rosterID, year } =
            getRosterIDFromManagerID(
                leagueTeamManagers,
                manager.managerID
            ) || { rosterID, year });
    }

    const commissioner = manager.managerID
        ? leagueTeamManagers.users[manager.managerID].is_owner
        : false;

    const scores = manager.windowScores ?? {
        winNow: 0,
        dynasty: 0,
        rebuild: 0
    };

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

        // WN / DYN:
        // 0   = red
        // 25  = orange
        // 50  = yellow
        // 75  = green
        // 100 = blue
        //
        // REB is inverted when this function is called,
        // so high rebuild becomes red and low rebuild becomes blue.

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

        const range = upper.value - lower.value;

        const t =
            range === 0
                ? 0
                : (value - lower.value) / range;

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

<style>
    .manager {
        display: flex;
        justify-content: left;
        align-items: center;
        padding: 1em 0;
        background-color: var(--fff);
        background-repeat: no-repeat;
        background-position: 15% 50%;
        margin: 0.5em 0;
        border-radius: 2em;
        border: 1px solid var(--ccc);
        box-shadow: 0 0 6px 0 var(--bbb);
        cursor: pointer;
    }

    .manager:hover {
        box-shadow: 0 0 10px 0 var(--g999);
        background-color: var(--eee);
    }

    .photo {
        height: 40px;
        width: 40px;
        border-radius: 100%;
        vertical-align: middle;
        margin-left: 1em;
        box-shadow: 0 0 2px 1px var(--bbb);
    }

    .name {
        text-align: center;
        display: inline-block;
        color: var(--g555);
        line-height: 1.2em;
        margin-left: 1em;
        font-weight: 700;
    }

    .team {
        text-align: center;
        display: inline-block;
        font-style: italic;
        line-height: 1.2em;
        color: var(--g555);
        font-weight: 300;
        margin-left: 1em;
    }

    .spacer {
        flex-grow: 1;
    }

    .info {
        display: flex;
        align-items: center;
    }

    .infoSlot {
        text-align: center;
        margin: 0 0.5em;
        width: 63px;
    }

    .scoreCircle {
        display: inline-flex;
        height: 40px;
        width: 40px;
        justify-content: center;
        align-items: center;
        border-radius: 100%;
        border: 1px solid;
        font-size: 0.9em;
        font-weight: 700;
        color: var(--g555);
        box-sizing: border-box;
    }

    .scoreLabel {
        width: 63px;
        text-align: center;
        font-size: 0.68em;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: var(--g555);
        margin-top: 2px;
    }

    .avatarHolder {
        display: inline-flex;
        position: relative;
    }

    .commissionerBadge {
        display: flex;
        justify-content: center;
        align-items: center;
        position: absolute;
        bottom: -10px;
        right: -10px;
        height: 25px;
        width: 25px;
        font-weight: 600;
        border-radius: 15px;
        background-color: var(--blueTwo);
        border: 1px solid var(--blueOne);
        color: #fff;
    }

    @media (max-width: 665px) {
        .name {
            font-size: 0.9em;
            margin-left: 0.5em;
        }

        .team {
            font-size: 0.8em;
            margin-left: 0.5em;
        }
    }

    @media (max-width: 595px) {
        .manager {
            padding: 0.5em 0;
            margin: 0.3em 0;
            border-radius: 1.5em;
        }

        .photo {
            height: 30px;
            width: 30px;
            margin-left: 0.5em;
        }

        .commissionerBadge {
            height: 15px;
            width: 15px;
            font-size: 0.8em;
        }

        .infoSlot {
            margin: 0 0.4em;
            width: 56px;
        }

        .scoreCircle {
            height: 30px;
            width: 30px;
            font-size: 0.75em;
        }

        .scoreLabel {
            width: 56px;
            font-size: 0.6em;
        }
    }

    @media (max-width: 475px) {
        .name {
            font-size: 0.8em;
            margin-left: 0.4em;
        }

        .team {
            font-size: 0.7em;
            margin-left: 0.4em;
        }

        .photo {
            height: 25px;
            width: 25px;
        }

        .infoSlot {
            margin: 0 0.25em;
            width: 49px;
        }

        .scoreCircle {
            height: 25px;
            width: 25px;
            font-size: 0.65em;
        }

        .scoreLabel {
            width: 49px;
            font-size: 0.55em;
        }
    }

    @media (max-width: 370px) {
        .team {
            display: none;
        }

        .infoSlot {
            margin: 0 0.15em;
        }
    }
</style>

<div
    class="manager"
    style="{retired
        ? 'background-image: url(/retired.png); background-color: var(--ddd)'
        : ''}"
    onclick={() => goto(`/manager?manager=${key}`)}
>
    <div class="avatarHolder">
        <img
            class="photo"
            src="{manager.photo}"
            alt="{manager.name}"
        />

        {#if commissioner}
            <div class="commissionerBadge">
                <span>C</span>
            </div>
        {/if}
    </div>

    <div class="name">
        {manager.name}
    </div>

    <div class="team">
        {getTeamNameFromTeamManagers(
            leagueTeamManagers,
            rosterID,
            year
        )}
    </div>

    <div class="spacer"></div>

    {#if !retired}
        <div class="info">

            <!-- Win Now -->
            <div class="infoSlot">
                <div
                    class="scoreCircle"
                    title="Win Now: {scores.winNow}"
                    style="
                        background-color: {getScoreColor(scores.winNow)};
                        border-color: {getScoreBorderColor(scores.winNow)};
                    "
                >
                    {scores.winNow}
                </div>

                <div class="scoreLabel">
                    WN
                </div>
            </div>

            <!-- Dynasty -->
            <div class="infoSlot">
                <div
                    class="scoreCircle"
                    title="Dynasty: {scores.dynasty}"
                    style="
                        background-color: {getScoreColor(scores.dynasty)};
                        border-color: {getScoreBorderColor(scores.dynasty)};
                    "
                >
                    {scores.dynasty}
                </div>

                <div class="scoreLabel">
                    DYN
                </div>
            </div>

            <!-- Rebuild -->
            <div class="infoSlot">
                <div
                    class="scoreCircle"
                    title="Rebuild: {scores.rebuild}"
                    style="
                        background-color: {getScoreColor(scores.rebuild, true)};
                        border-color: {getScoreBorderColor(scores.rebuild, true)};
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
