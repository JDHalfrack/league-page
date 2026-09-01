import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';


const MAX_BODY_LENGTH =
    45000;


const WRITERS = [
    {
        id:
            'openai/gpt-oss-20b',

        label:
            'GPT-OSS 20B'
    },

    {
        id:
            'openai/gpt-oss-120b',

        label:
            'GPT-OSS 120B'
    }
];


const shuffle = input => {
    const output =
        [...input];


    for (
        let i =
            output.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() *
                (
                    i + 1
                )
            );


        [
            output[i],
            output[j]
        ] = [
            output[j],
            output[i]
        ];
    }


    return output;
};


/*
    =====================================================
    OUTPUT NORMALIZATION
    =====================================================

    "playoff" is the house style.

    This is safe editorial normalization, not factual
    rewriting.
*/

const normalizeHouseStyle =
    text => {

        return String(
            text ||
            ''
        )
            .replace(
                /\bplay[\s-]offs?\b/gi,
                match => {
                    const plural =
                        /s$/i.test(
                            match
                        );

                    return plural
                        ? 'playoffs'
                        : 'playoff';
                }
            )
            .trim();
    };


const cleanText = text => {
    return String(
        text ||
        ''
    )
        .trim()
        .replace(
            /^```(?:json)?\s*/i,
            ''
        )
        .replace(
            /\s*```$/i,
            ''
        )
        .trim();
};


const parseArticle = text => {
    const cleaned =
        cleanText(
            text
        );


    let parsed =
        null;


    try {
        parsed =
            JSON.parse(
                cleaned
            );
    }
    catch {
        const first =
            cleaned.indexOf(
                '{'
            );

        const last =
            cleaned.lastIndexOf(
                '}'
            );


        if (
            first !== -1 &&
            last > first
        ) {
            try {
                parsed =
                    JSON.parse(
                        cleaned.slice(
                            first,
                            last + 1
                        )
                    );
            }
            catch {
                parsed =
                    null;
            }
        }
    }


    if (!parsed) {
        return null;
    }


    const headline =
        normalizeHouseStyle(
            String(
                parsed.headline ||
                ''
            )
                .replace(
                    /\*\*/g,
                    ''
                )
                .replace(
                    /^#+\s*/,
                    ''
                )
        );


    let paragraphs =
        parsed.paragraphs ||
        parsed.article;


    if (
        typeof paragraphs ===
        'string'
    ) {
        paragraphs =
            paragraphs
                .split(
                    /\n\s*\n/
                )
                .map(
                    p =>
                        p.trim()
                )
                .filter(Boolean);
    }


    if (
        Array.isArray(
            paragraphs
        )
    ) {
        paragraphs =
            paragraphs
                .map(
                    p =>
                        normalizeHouseStyle(
                            String(
                                p ||
                                ''
                            )
                                .replace(
                                    /\*\*/g,
                                    ''
                                )
                        )
                )
                .filter(Boolean);
    }
    else {
        paragraphs =
            [];
    }


    if (
        !headline ||
        !paragraphs.length
    ) {
        return null;
    }


    return {
        headline,
        paragraphs
    };
};


const makeGroqError = (
    writer,
    response,
    result
) => {
    const message =
        result
            ?.error
            ?.message ||
        result
            ?.message ||
        `Groq returned HTTP ${response.status}.`;


    const error =
        new Error(
            `${response.status}: ${message}`
        );


    error.status =
        response.status;

    error.writer =
        writer.id;


    return error;
};


const askWriter = async (
    writer,
    systemPrompt,
    serializedData
) => {
    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () =>
                controller.abort(),
            25000
        );


    try {
        const response =
            await fetch(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    method:
                        'POST',

                    signal:
                        controller.signal,

                    headers: {
                        'Content-Type':
                            'application/json',

                        'Authorization':
                            `Bearer ${env.GROQ_API_KEY}`
                    },

                    body:
                        JSON.stringify({
                            model:
                                writer.id,

                            messages: [
                                {
                                    role:
                                        'system',

                                    content:
                                        systemPrompt
                                },

                                {
                                    role:
                                        'user',

                                    content:
                                        serializedData
                                }
                            ],

                            max_completion_tokens:
                                1000,

                            temperature:
                                0.9,

                            top_p:
                                0.94,

                            response_format: {
                                type:
                                    'json_object'
                            },

                            reasoning_effort:
                                'low'
                        })
                }
            );


        let result;


        try {
            result =
                await response.json();
        }
        catch {
            const error =
                new Error(
                    `${response.status}: ${writer.label} returned an unreadable response.`
                );


            error.status =
                response.status;

            throw error;
        }


        if (!response.ok) {
            throw makeGroqError(
                writer,
                response,
                result
            );
        }


        const rawText =
            result
                ?.choices
                ?.[0]
                ?.message
                ?.content;


        if (!rawText) {
            throw new Error(
                `${writer.label} returned an empty article.`
            );
        }


        const article =
            parseArticle(
                rawText
            );


        if (!article) {
            throw new Error(
                `${writer.label} returned an unusable article.`
            );
        }


        return {
            article,

            model:
                result.model ||
                writer.id,

            writer:
                writer.label
        };
    }
    finally {
        clearTimeout(
            timeout
        );
    }
};


export async function POST({
    request
}) {
    if (
        !env.GROQ_API_KEY
    ) {
        return json(
            {
                error:
                    'GROQ_API_KEY is not configured.'
            },
            {
                status:
                    500
            }
        );
    }


    let body;


    try {
        body =
            await request.json();
    }
    catch {
        return json(
            {
                error:
                    'Invalid rivalry request.'
            },
            {
                status:
                    400
            }
        );
    }


    const {
        managerOne,
        managerTwo,
        factSheet
    } =
        body ??
        {};


    if (
        !managerOne ||
        !managerTwo ||
        !factSheet
    ) {
        return json(
            {
                error:
                    'Complete rivalry data is required.'
            },
            {
                status:
                    400
            }
        );
    }


    const serializedData =
        JSON.stringify({
            managerOne,
            managerTwo,
            factSheet
        });


    const bodyLength =
        serializedData.length;


    if (
        bodyLength >
        MAX_BODY_LENGTH
    ) {
        return json(
            {
                error:
                    (
                        `Rivalry dossier is unexpectedly large: ` +
                        `${bodyLength.toLocaleString()} characters.`
                    )
            },
            {
                status:
                    413
            }
        );
    }


    const systemPrompt = `
You write rivalry columns for the USCCFFL fantasy-football league.

The application has already calculated the facts. Write the story. Do not recalculate history.


FACT SAFETY

Use only supplied facts.

Never invent:
- games
- scores
- records
- streaks
- championships
- motives
- quotes
- psychology
- fan reactions
- importance to league standings
- timing between meetings

0-0 means unplayed.

Regular season and playoffs are different categories unless an explicit combined record is supplied.

Adjacent chronology entries are consecutive RIVALRY MEETINGS, not necessarily consecutive football weeks.

Never invent "the following week," "the next week," or similar timing.

Do not perform historical arithmetic.


RIVALRY IDENTITY IS GUIDANCE, NOT COPY

factSheet.rivalryIdentity exists to help you choose the tone of the opening.

Do NOT discuss:
- a frequency spectrum
- a ranking spectrum
- a middle tier
- a middle category
- an internal classification
- a frequency class
- a cadence class
- a size tier
- where the rivalry "sits" in a classification system

Never write anything resembling:
"the rivalry sits in the middle of the frequency spectrum."

If no importanceDescription is supplied, DO NOT discuss league-wide importance at all.

If no familiarityDescription is supplied, DO NOT make frequency itself a talking point.

Translate supplied noteworthy context into natural prose rather than explaining the application's classification system.


CADENCE

cadence controls season-to-season wording.

EVERY_COMPLETED_SEASON:
you may say they have met every completed season they shared.

NEARLY_EVERY_SEASON:
you may say they have met often or in nearly every shared season, but NEVER literally every season.

INTERMITTENT:
their meetings have skipped multiple seasons. Do not portray them as an annual fixture.

RARE:
they have missed each other more often than they have met.

UNKNOWN:
do not discuss season-to-season cadence.

Never infer cadence from a total matchup count.


OPENING

Give the rivalry some life before listing statistics.

The opening should feel specific to the supplied history.

Useful approaches include:
- familiarity when the supplied identity supports it
- limited history when supplied identity supports it
- strange or contrasting results
- repeated swings in the series
- scoring extremes
- understated humor
- a genuinely interesting first-meeting or recent-history angle

Do NOT invent emotional escalation.

One high-scoring game is NOT evidence that:
- the rivalry was getting more intense
- tensions were rising
- the rivalry was heating up
- either manager suddenly cared more

Do not invent spectators or fan response.

Never write:
"fans were glued to the scoreboard"
"fans were on the edge of their seats"
"the league was watching"

unless such information were explicitly supplied, which it normally is not.

Do not begin mechanically with the current win-loss record.


SEMANTIC REDUNDANCY

This is a hard editorial rule.

A narrower statistic should NOT be used when it is completely contained inside a broader statistic already used.

Examples:

If the current streak is four wins:
DO NOT also say that manager won the last three.

If the current streak is five wins:
DO NOT also say that manager is 5-0 in the last five.

If a manager is 2-0 in all playoff meetings:
DO NOT later say the manager won both playoff games.

If the series is tied:
DO NOT later say neither manager has the advantage.

If one sentence says a four-game streak erased a deficit and tied the series:
DO NOT separately repeat the tied record as another consequence of the same streak.

Choose the strongest version of overlapping facts and discard the weaker versions.

factSheet.recent may intentionally omit a window because the application determined it would be redundant. Never reconstruct an omitted recent window yourself.


ARTICLE STRUCTURE

Write 3 or 4 paragraphs.

Paragraph 1:
Rivalry-specific hook plus the main historical story.

Paragraph 2:
Recent form, streak, historical swing, or another distinct development.

Paragraph 3:
A scoring or game-character angle.

Paragraph 4:
OPTIONAL.

Use a fourth paragraph only if there is a genuinely distinct unused idea such as:
- playoff history
- trade history
- unusual season pattern
- career contrast
- meaningful lead-change history

Do NOT add a fourth paragraph merely to provide a conclusion.


ENDING

You do NOT need a traditional conclusion.

It is perfectly acceptable for the article to end after the final substantive historical point.

Avoid empty forward-looking copy such as:
- "looking ahead"
- "the next encounter could swing the balance"
- "expect fireworks"
- "the next chapter"
- "only time will tell"
- "the next clash will decide"
- "anything can happen"

Do not predict future scoring from past scoring.

Do not repeat the current record or current streak merely to create a closing sentence.


PLAYOFF LANGUAGE

Always spell:
"playoff"
or
"playoffs"

Never:
"play-off"
"play-offs"
"play off"
"play offs"

A playoff record describes PLAYOFF RESULTS.

Do not inflate it into unsupported claims about:
- performing under pressure
- thriving when stakes are highest
- clutch ability
- championship pedigree

Good:
"TruSoldier has won both playoff meetings."

Bad:
"TruSoldier dominates when the stakes are highest."


STATISTICAL DISCIPLINE

Keep different statistical categories separate.

A highest individual score is not a count of 150+ performances.

A highest combined game total is NOT one manager's individual score.

A margin is not a total score.

Use either:
"150+"
or
"150-plus"

Never:
"150+-plus"

Never call something "the only" example if other qualifying examples are supplied.

Do not perform arithmetic that the application has not explicitly supplied.


CAUSAL LANGUAGE

Do not create a cause-and-effect story merely because two verified facts appear near each other.

BAD:
"That 166-point performance showed the rivalry was becoming more intense."

BAD:
"That close win set the tone for everything that followed."

unless the supplied data explicitly establishes the claimed relationship.

Safer:
"JDHalfrack scored 166 in that meeting."

Then move to the next verified idea.


REPETITION

A central fact should normally appear once.

Do not repeat a fact by changing the wording.

For example, these all express essentially the same state:
- "the series is tied"
- "the rivalry is dead even"
- "neither side has the advantage"
- "the managers are level"

Choose one.

Do the same for streaks, playoff records, extremes, and recent form.


VOICE

Write like someone who actually follows this fantasy league.

Be:
- lively
- specific
- conversational
- occasionally funny
- willing to tease poor results
- willing to appreciate absurd fantasy scores

Mild profanity is allowed occasionally when natural.

Sports clichés are allowed, but do not repeat or stack them.

Do not invent psychology.

Do not invent audience reaction.

Avoid unsupported superlatives.


SELF-CHECK

Before returning the article, silently verify:

1. Did I expose an internal classification or spectrum?
2. Did I use "play-off" instead of "playoff"?
3. Did I repeat a narrower recent statistic already contained in a streak?
4. Did I repeat the current record in different words?
5. Did I invent intensity, fan reaction, or psychology?
6. Did I turn playoff results into a claim about pressure or stakes?
7. Did I invent chronology?
8. Did I mix statistical categories?
9. Did I add a generic predictive conclusion?
10. Does every paragraph contain a genuinely distinct idea?

Fix any problem before responding.


LENGTH

Target roughly 275-400 words.

Use 3 paragraphs when three strong ideas are enough.

Use 4 only when the fourth adds genuinely new information.

No filler.


OUTPUT

Return only valid JSON:

{
  "headline": "Short headline",
  "paragraphs": [
    "Paragraph one.",
    "Paragraph two.",
    "Paragraph three."
  ]
}

A fourth paragraph is optional.

No markdown.
No code fences.

Everything below is verified application data.
`;


    const writers =
        shuffle(
            WRITERS
        );


    const failures =
        [];


    for (
        const writer
        of writers
    ) {
        try {
            const result =
                await askWriter(
                    writer,
                    systemPrompt,
                    serializedData
                );


            return json({
                ...result,

                diagnostics: {
                    dossierCharacters:
                        bodyLength
                }
            });
        }
        catch (error) {
            const message =
                error?.name ===
                    'AbortError'
                    ? `${writer.label} timed out.`
                    : (
                        error?.message ||
                        `${writer.label} failed.`
                    );


            failures.push({
                writer:
                    writer.id,

                status:
                    error?.status ||
                    null,

                error:
                    message
            });


            console.warn(
                'Groq rivalry writer failed:',
                writer.id,
                message
            );
        }
    }


    const firstFailure =
        failures[0];


    console.error(
        'All Groq rivalry writers failed:',
        failures
    );


    return json(
        {
            error:
                firstFailure?.error ||
                'The rivalry writers are unavailable right now.',

            failures
        },
        {
            status:
                503
        }
    );
}
