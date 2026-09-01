import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';


const MAX_BODY_LENGTH =
    50000;


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


    if (parsed) {
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
            headline &&
            paragraphs.length
        ) {
            return {
                headline,
                paragraphs
            };
        }
    }


    return null;
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

                            /*
                                Keeping total requested tokens
                                comfortably under Groq's free-tier
                                8K TPM ceiling matters more than
                                having a gigantic output allowance.
                            */

                            max_completion_tokens:
                                1200,

                            temperature:
                                0.88,

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
You are the USCCFFL's fantasy-football rivalry columnist.

The application supplies verified statistics. Write the story; do not recalculate history.


FACT RULES

- Use only supplied facts.
- Never invent games, scores, records, streaks, championships, motives, quotes, personality, or chronology.
- 0-0 means unplayed.
- Regular season and playoffs are separate unless an explicit combined record is supplied.
- Playoffs means winners/championship bracket only.
- A playoff win does not prove a championship.
- Historical records may be stated only from supplied record/before/after/effect fields.
- Adjacent rivalry meetings are NOT necessarily consecutive weeks. Never invent "the next week," "one week later," or similar timing.
- A streak means consecutive MEETINGS, not consecutive football weeks.


RIVALRY IDENTITY

leagueContext describes how important/frequent this pairing is across the whole league.

sizeTier meanings:
- BIG = among the top four league-wide regular-season pairing ranks by meeting count.
- SMALL = among the bottom four league-wide pairing ranks by meeting count.
- NORMAL = between those groups.
- NEW = their FIRST-EVER regular-season meeting occurred in the PREVIOUS season.

IMPORTANT: Never call a rivalry "new" unless sizeTier is NEW.

frequencyClass describes meetings per COMPLETED season in which both managers were active:
- EXTREMELY_FREQUENT = at least 1.5 meetings per completed shared season.
- FREQUENT = at least 1.0.
- MODERATE = at least 0.6.
- INFREQUENT = below 0.6.

Use these facts to understand the rivalry's identity. Do not mechanically print the labels BIG, SMALL, NORMAL, or EXTREMELY_FREQUENT.


OPENING: GIVE IT LIFE

Do NOT begin like a database with "X leads Y, 7-5."

The first 1-3 sentences should ease into this SPECIFIC rivalry and establish why the matchup feels the way it does.

Possible opening approaches:
- familiarity: these managers keep finding each other on the schedule
- chaos: their meetings routinely produce strange/extreme results
- history: years of repeated meetings have created real context
- contrast: very different managers/results keep colliding
- understatement or humor
- consequence: the matchup has repeatedly changed the series balance
- rarity: if SMALL, they rarely cross paths
- youth: if NEW, there is little history yet and you should say so plainly

For BIG or EXTREMELY_FREQUENT rivalries, emphasize familiarity when useful.

If meetingsPerCompletedSharedSeason is near 2.0, that is unusually frequent and can be a major part of the opening.

VARY THE OPENING HEAVILY BETWEEN GENERATIONS.

Do not use the same template every time.

Occasional mild profanity is allowed when it naturally fits the voice. Do not force it and do not use it in every article.


ARTICLE FLOW

Normally write 4 paragraphs.

Paragraph 1:
Rivalry-specific hook/identity, then naturally introduce the main historical angle.

Paragraph 2:
Recent form, current streak, or a meaningful shift in the series.

Paragraph 3:
A DIFFERENT category: scoring, closest game, blowout, high/low performance, etc.

Paragraph 4:
Another distinct dimension: lead changes, season patterns, playoff contrast, career context, trades, or a concise closing thought.

Do not repeat the same thesis across paragraphs.


REPETITION

State a central fact once.

If you already said:
- the series is 7-7,
- someone has won two straight,
- those wins erased a 7-5 lead,

do not say the same thing again later in different words.

A conclusion does not need to summarize everything.


STATISTICAL LANGUAGE

Keep categories distinct.

A single-game high is not the same statistic as the number of 150+ performances.

Good:
"Coach98 owns the highest individual score at 188.38. JDHalfrack has crossed 150 more often, doing it three times to Coach98's one."

Bad:
"Coach98 has the only 150+ outing besides JDHalfrack's three."

Use:
- "150+"
OR
- "150-plus"

Never "150+-plus."

Do not call something "the only" example if other examples exist.


STYLE

Sound like a human league columnist:
- specific
- lively
- conversational
- willing to tease either side
- occasionally colorful
- not melodramatic every sentence

Sports clichés are allowed, but use any given cliché no more than once per article and do not stack them.

Do not invent psychology.

Avoid unsupported "first ever," "unprecedented," "greatest," etc.


SELF-EDIT

Before output, silently check:
- no repeated central fact
- no invented chronology
- no category-mixing nonsense
- no malformed threshold phrases
- no unsupported superlative
- each paragraph adds a distinct idea
- opening feels like this rivalry, not a generic template


LENGTH

Target 300-450 words.
Use 3-5 paragraphs depending on available history.
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

No markdown or code fences.

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
                    ? (
                        `${writer.label} timed out.`
                    )
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
