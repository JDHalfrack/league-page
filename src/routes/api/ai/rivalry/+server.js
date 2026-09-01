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
            .trim();


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
                        String(
                            p ||
                            ''
                        )
                            .replace(
                                /\*\*/g,
                                ''
                            )
                            .trim()
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

Never invent games, scores, records, streaks, championships, motives, quotes, psychology, or timing between games.

0-0 is unplayed.

Regular season and playoffs are separate unless an explicit combined record is supplied.

Adjacent chronology entries are consecutive RIVALRY MEETINGS, not necessarily consecutive football weeks.

Never invent "the following week," "one week later," or similar timing.

Do not perform historical arithmetic.


RIVALRY IDENTITY

factSheet.rivalryIdentity is authoritative.

size:

BIG =
one of the four most-played regular-season pairings between managers who are CURRENTLY active in the league.

SMALL =
one of the four least-played established regular-season pairings between managers who are CURRENTLY active.

NORMAL =
between those groups.

NEW =
their first-ever regular-season meeting occurred last season.

UNRANKED =
the pairing is not eligible for current-manager league rankings.

Historical pairings involving retired managers are NOT part of the BIG/SMALL ranking pool.


FREQUENCY

frequency describes how much total familiarity this pairing has built relative to completed shared seasons.

Use the supplied description.

Do not calculate or state a games-per-season average.


CADENCE

cadence tells you whether they actually met during the completed seasons they shared.

EVERY_COMPLETED_SEASON =
they truly met in every completed shared season.

NEARLY_EVERY_SEASON =
they missed exactly some history; do not say literally every season.

INTERMITTENT =
they missed each other during multiple completed seasons.

RARE =
they missed each other more often than they met.

UNKNOWN =
do not characterize season-to-season cadence.


HARD CADENCE RULE

NEVER write:

"they meet each season"
"they face each other every year"
"an annual matchup"
"a yearly fixture"
"every season brings another meeting"
"they always find each other on the schedule"

unless cadence is exactly EVERY_COMPLETED_SEASON.

If cadence is INTERMITTENT, the writing must acknowledge that the matchup has NOT happened consistently every season.

Do not convert total matchup count into an assumption about season-to-season regularity.


FREQUENCY WORDING

Describe frequency with WORDS.

Do not write:
- X meetings in Y seasons
- X times over Y years
- an average of X games per year
- twice per season
- once per year
- any arithmetic explaining the classification

Actual historical meeting totals may be mentioned when relevant to the record itself, but do not use numbers to explain frequency.


OPENING

Give the rivalry some life before listing statistics.

The first 1-3 sentences should establish what KIND of rivalry this actually is.

For BIG:
you may emphasize that this pairing has accumulated unusually extensive history among current managers.

For SMALL:
emphasize that the history is relatively limited.

For NEW:
the history has only just begun.

For INTERMITTENT:
do NOT portray the matchup as a permanent annual fixture. It may have history without being constant.

For EXTREMELY_FREQUENT plus EVERY_COMPLETED_SEASON:
strong familiarity language is appropriate.

Vary openings heavily.

Do not begin mechanically with the current record.


ARTICLE

Usually write four paragraphs.

1. Rivalry-specific hook and main historical angle.
2. Recent form, streak, or shift in control.
3. A distinct scoring story.
4. Another historical dimension or concise conclusion.

Each paragraph needs a different job.


REPETITION

State a major fact once.

Do not say:
"the series is tied"
then later
"they are dead even"
then later
"neither has an advantage"
then end by repeating the tied record.

Move on to another subject.


STATISTICAL DISCIPLINE

Keep statistical categories separate.

A highest individual score is not a count of 150+ performances.

Use either:
"150+"
or
"150-plus"

Never:
"150+-plus"

Never call something "the only" example when other examples exist.

Do not perform arithmetic that the application has not explicitly supplied.


STYLE

Write like someone who follows this fantasy league.

Be lively, specific, conversational, occasionally colorful, and willing to tease results.

Mild profanity is allowed occasionally when natural.

Sports clichés are allowed but should not be repeated or stacked.

Do not invent psychology.

Avoid unsupported superlatives.


SELF-CHECK

Before output, verify:

- Did I claim they meet every season without EVERY_COMPLETED_SEASON?
- Did I mistake a modest/intermittent rivalry for a major fixture?
- Did I use numbers to calculate frequency?
- Did I repeat the main record or streak?
- Did I invent chronology?
- Did I mix statistical categories?
- Does each paragraph add a new idea?

Fix any problem before returning the article.


LENGTH

Target 300-425 words.

Use 3-5 paragraphs.

No filler.


OUTPUT

Return only valid JSON:

{
  "headline": "Short headline",
  "paragraphs": [
    "Paragraph one.",
    "Paragraph two.",
    "Paragraph three.",
    "Paragraph four."
  ]
}

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
