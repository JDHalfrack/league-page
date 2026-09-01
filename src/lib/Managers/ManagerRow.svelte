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

        const t = value / 100;

        // True red -> blue interpolation
        const start = {
            r: 225,
            g: 95,
            b: 95
        };

        const end = {
            r: 85,
            g: 125,
            b: 225
        };

        const r = Math.round(
            start.r +
            (end.r - start.r) * t
        );

        const g = Math.round(
            start.g +
            (end.g - start.g) * t
        );

        const b = Math.round(
            start.b +
            (end.b - start.b) * t
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
