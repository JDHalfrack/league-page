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

                            /*
                                Reduced again for more TPM headroom.

                                300-425 words does not need a giant
                                completion allowance.
                            */

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

The application has already calculated the facts. Your job is to turn them into an entertaining column, not to recalculate them.


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
- personality
- timing between games

0-0 is unplayed.

Regular season and playoffs are different categories unless an explicit combined record is supplied.

A playoff win does not prove a championship.

Historical series records must come from supplied record, before, after, or effect fields.

Adjacent entries in chronology are consecutive RIVALRY MEETINGS, not necessarily consecutive football weeks.

Never invent phrases such as "the following week" or "one week later."


RIVALRY IDENTITY

factSheet.rivalryIdentity is authoritative qualitative context.

Its size values mean:

BIG:
One of the league's most frequently played established regular-season pairings.

SMALL:
One of the league's less frequently played established pairings.

NORMAL:
Neither unusually common nor unusually rare league-wide.

NEW:
Their first-ever regular-season meeting happened LAST SEASON.

Never call a rivalry new unless the supplied size is NEW.

Its frequency values mean:

EXTREMELY_FREQUENT:
These managers cross paths unusually often and are highly familiar opponents.

FREQUENT:
They meet regularly and have meaningful familiarity.

MODERATE:
Their meeting frequency is fairly ordinary.

INFREQUENT:
They rarely cross paths.

Use the supplied WORD DESCRIPTIONS to characterize frequency.


ABSOLUTE FREQUENCY-WORDING RULE

Describe matchup frequency QUALITATIVELY.

Do NOT quantify frequency.

Do NOT write:
- "X meetings in Y seasons"
- "X times over Y years"
- "an average of X games per season"
- "twice a year"
- "once per season"
- "1.5 meetings per season"
- any calculation connecting meeting count to season count

Do not calculate a frequency yourself.

Do not explain WHY the application classified the rivalry as frequent.

Simply describe what the classification means in natural language.

GOOD:
"These two have become extremely familiar opponents."

GOOD:
"This matchup keeps finding its way back onto the schedule."

GOOD:
"They rarely cross paths, which gives their limited history a different feel."

GOOD:
"Few established pairings are more familiar around the USCCFFL."

BAD:
"They have met nine times in eight seasons."

BAD:
"Fourteen meetings over seven seasons works out to twice a year."

BAD:
"With an average of 1.75 meetings per season..."

Actual meeting totals may be mentioned elsewhere when relevant to historical statistics, but NEVER use a number or arithmetic to describe how frequent the rivalry is.


OPENING

Give the rivalry some life before dumping statistics on the reader.

The first 1-3 sentences should establish the IDENTITY of this particular matchup.

Possible approaches:
- familiarity
- rarity
- chaos
- contrasting histories
- repeated swings in control
- strange scoring history
- postseason tension
- understatement
- humor
- occasional mild profanity when it genuinely fits

For a BIG or EXTREMELY_FREQUENT rivalry, it is natural to emphasize how familiar the opponents have become.

For SMALL or INFREQUENT, emphasize that they do not see each other often.

For NEW, acknowledge that the history has only just begun.

Do NOT start with:
"Manager A leads Manager B 7-5."

Do NOT mechanically state:
"This is a BIG rivalry."

Translate the classification into natural prose.

Vary the opening substantially between generations. There is no required opening template.


ARTICLE SHAPE

Usually write 4 paragraphs.

Paragraph 1:
Rivalry identity and hook, then introduce the principal historical storyline.

Paragraph 2:
Recent form, streak, or change in control.

Paragraph 3:
A distinct scoring angle: extremes, averages, close games, blowouts, threshold performances, etc.

Paragraph 4:
Another distinct dimension or a concise closing thought: lead changes, season patterns, playoffs, careers, or trades.

Each paragraph should have a different job.


NO REPETITION

State a major fact once.

If you already said the series is tied, do not later say it is "dead even," then "level," then repeat the tied record in the conclusion.

If you already explained what a current streak changed, do not explain the same effect again.

Move the story forward.


STATISTICAL DISCIPLINE

Keep different statistic types separate.

A highest single-game score is not the same thing as frequency above 150.

GOOD:
"Coach98 owns the highest individual score. JDHalfrack has crossed 150 more often."

BAD:
"Coach98 has the only 150+ game besides JDHalfrack's three."

Use either "150+" or "150-plus."

Never write "150+-plus."

Never call something "the only" example when other supplied examples exist.

Do not perform your own statistical arithmetic.


VOICE

Sound like someone who actually follows this fantasy league:
- lively
- specific
- conversational
- willing to tease results
- occasionally colorful
- not relentlessly dramatic

Sports clichés are allowed, but do not repeat the same cliché in one article and do not stack them.

Do not invent psychology.

Do not make unsupported claims such as "first ever," "unprecedented," "greatest," or "most important."


SELF-CHECK

Before returning the column, silently verify:
- frequency is described with WORDS, not arithmetic
- no current unplayed season was treated as historical evidence
- no central fact is repeated
- no invented chronology
- no mixed statistical categories
- no malformed threshold phrases
- each paragraph adds something new
- the opening sounds specific to this rivalry


LENGTH

Target roughly 300-425 words.

Use 3-5 paragraphs depending on the history.

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

Everything below this line is verified application data.
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
