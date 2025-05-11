import type { AllMiddlewareArgs, SlackCommandMiddlewareArgs, StringIndexed } from "@slack/bolt";
import { parseDate } from "chrono-node";

// Written by GPT-4o. I would've spent way too much time on this otherwise.
function getTimezoneOffsetMinutes(ianaTimeZone: string): number | null {
    const date = new Date();

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: ianaTimeZone,
        timeZoneName: 'shortOffset',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');

    if (!offsetPart || typeof offsetPart.value !== 'string') return null;

    const match = offsetPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

    if (!match || !match[1] || !match[2]) {
        return null;
    }

    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3] ?? '0', 10); // use 0 if match[3] is undefined

    if (isNaN(hours) || isNaN(minutes)) return null;

    return sign * (hours * 60 + minutes);
}

function getBMTBeatTime(date: Date): `@${string}` {
    // Ensure the provided date is adjusted to UTC+1 (Biel Mean Time)
    const bmt = new Date(date.getTime() + 3600000); // Add 1 hour in milliseconds to get UTC+1
    
    // Calculate total seconds since midnight in BMT (UTC+1)
    const seconds = bmt.getUTCHours() * 3600 + bmt.getUTCMinutes() * 60 + bmt.getUTCSeconds();

    // Calculate .beat time (1 beat = 86.4 seconds, so total beats = total seconds / 86.4)
    const beat = Math.round(seconds / 86.4).toString().padStart(3, '0');

    return `@${beat}`;
}
// End of GPT-4o written code.

export default async function beatCommand(ctx: SlackCommandMiddlewareArgs & AllMiddlewareArgs<StringIndexed>) {
    const args = ctx.payload.text.split(/ +/g).filter(x => x);

    if (!args.length) {
        // Convert the time now if no arguments given
        const now = new Date();
        const beat = getBMTBeatTime(now);

        await ctx.ack({
            response_type: 'ephemeral',
            text: `No arguments passed... the current time is ${beat} or ${now.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short',
                timeZone: 'UTC'
            })}`,
            blocks: [
                {
                    type: "context",
                    elements: [
                        {
                            type: "mrkdwn",
                            text: "_thump thump_ | no arguments passed, getting current time"
                        }
                    ]
                },
                {
                    type: "rich_text",
                    elements: [
                        {
                            type: "rich_text_section",
                            elements: [
                                {
                                    type: "text",
                                    text: ".beat time\n"
                                },
                                {
                                    type: "text",
                                    text: `${beat}\n\n`,
                                    style: {
                                        bold: true
                                    }
                                },
                                {
                                    type: "text",
                                    text: "Time string (in your local time!)\n"
                                },
                                {
                                    type: "date",
                                    timestamp: now.valueOf(),
                                    format: "{time}",
                                    style: {
                                        bold: true
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        })
    } else if (args[0]!.startsWith('@') && args[0]!.length == 4) { // @XXX
        // Convert the time from .beat
        const beat = args[0]!.slice(1)

        const b = parseInt(beat);

        if (isNaN(b)) {
            return await ctx.ack({
                response_type: 'ephemeral',
                text: `Whoopsies.. the .beat you gave (\`${args[0]}\`) seems to be invalid..`
            })
        }

        const ms = b * 86.4 * 1000;

        const now = new Date();
        // in BMT (Biel Meridian Time)
        const midnightToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), -1, 0, 0)
              
        const result = new Date(midnightToday + ms);

        await ctx.ack({
            response_type: 'ephemeral',
            text: `A beat was passed... the resulting time is @${beat} or ${result.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short',
                timeZone: 'UTC'
            })}`,
            blocks: [
                {
                    type: "context",
                    elements: [
                        {
                            type: "mrkdwn",
                            text: "_thump thump_ | a beat was passed!"
                        }
                    ]
                },
                {
                    type: "rich_text",
                    elements: [
                        {
                            type: "rich_text_section",
                            elements: [
                                {
                                    type: "text",
                                    text: ".beat time\n"
                                },
                                {
                                    type: "text",
                                    text: `${args[0]}\n\n`,
                                    style: {
                                        bold: true
                                    }
                                },
                                {
                                    type: "text",
                                    text: "Time string (in your local time!)\n"
                                },
                                {
                                    type: "date",
                                    timestamp: result.valueOf(),
                                    format: "{time}",
                                    style: {
                                        bold: true
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        })        
    } else {
        const user = await ctx.client.users.info({ user: ctx.payload.user_id });

        if (!user.ok) {
            return await ctx.ack({
                response_type: 'ephemeral',
                text: "Weird edge case.. but you don't seem to be a valid user? I don't know either."
            })
        }

        const tzOffset = getTimezoneOffsetMinutes(user.user!.tz!);

        const date = parseDate(args.join(' '), {
            instant: new Date(),
            timezone: tzOffset ?? "UTC"
        }, {
            forwardDate: true
        });

        if (date == null) {
            return await ctx.ack({
                response_type: 'ephemeral',
                text: "I couldn't understand the time string you used. Sorry!"
            })
        }

        const beat = getBMTBeatTime(date);

        await ctx.ack({
            response_type: 'ephemeral',
            text: `A timestring was passed... the resulting time is ${beat} or ${date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short',
                timeZone: 'UTC'
            })} `,
            blocks: [
                {
                    type: "context",
                    elements: [
                        {
                            type: "mrkdwn",
                            text: "_thump thump_ | a timestring was passed!"
                        }
                    ]
                },
                {
                    type: "rich_text",
                    elements: [
                        {
                            type: "rich_text_section",
                            elements: [
                                {
                                    type: "text",
                                    text: ".beat time\n"
                                },
                                {
                                    type: "text",
                                    text: `${beat}\n\n`,
                                    style: {
                                        bold: true
                                    }
                                },
                                {
                                    type: "text",
                                    text: "Time string (in your local time!)\n"
                                },
                                {
                                    type: "date",
                                    timestamp: date.valueOf(),
                                    format: "{time}",
                                    style: {
                                        bold: true
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        })        
    }
}
