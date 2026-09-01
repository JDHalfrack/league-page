<script>
    import IconButton from '@smui/icon-button';

    export let year;
    export let displayWeek;
    export let selected;
    export let length;

    /*
        Optional custom label.

        Regular season:
            2026 Week 6

        Playoffs:
            2024 Semifinal
    */
    export let label = null;


    const nav = dir => {

        if (dir === "left") {

            if (selected > 0) {
                selected--;
            }
            else {
                selected =
                    length - 1;
            }

        }
        else {

            if (
                selected <
                length - 1
            ) {
                selected++;
            }
            else {
                selected = 0;
            }

        }
    };
</script>

<style>
    .container {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    h4 {
        display: inline-block;
        text-align: center;
        font-size: 1.6em;
        margin: 10px 20px;
    }
</style>


<div class="container">

    {#if length > 1}

        <IconButton
            class="material-icons"
            onclick={() =>
                nav("left")
            }
        >
            chevron_left
        </IconButton>

    {/if}


    <h4>
        {year}

        {#if label}
            {label}
        {:else}
            Week {displayWeek}
        {/if}
    </h4>


    {#if length > 1}

        <IconButton
            class="material-icons"
            onclick={() =>
                nav("right")
            }
        >
            chevron_right
        </IconButton>

    {/if}

</div>
