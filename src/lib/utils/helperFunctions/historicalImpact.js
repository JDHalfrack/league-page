/*
    =====================================================
    MARGIN BONUS
    =====================================================

    This is intentionally a small finishing adjustment.

    A game cannot become historically impactful because
    it was close. The game must first independently clear
    the Core Impact threshold.

    RANGES

        0–1      +8
        >1–3     +6
        >3–5     +4
        >5–7     +2
        >7–10    +1
        >10       0

    Anything decided by more than ten points receives no
    margin adjustment.
    =====================================================
*/

const getDramaBonus =
    margin => {

        const value =
            Number(
                margin
            );


        if (
            !Number.isFinite(
                value
            )
        ) {
            return 0;
        }


        if (
            value <= 1
        ) {
            return MAX_DRAMA_BONUS;
        }


        if (
            value <= 3
        ) {
            return 6;
        }


        if (
            value <= 5
        ) {
            return 4;
        }


        if (
            value <= 7
        ) {
            return 2;
        }


        if (
            value <= 10
        ) {
            return 1;
        }


        return 0;
    };
