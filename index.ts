import BoltJS from "@slack/bolt";
import "dotenv/config";
import fs from "fs/promises";
import path from "path";

const app = new BoltJS.App({
    signingSecret: process.env.SIGNING_SECRET,
    token: process.env.APP_TOKEN
});

// Dynamically initialize commands
const commandsDir = await fs.readdir(path.join(process.cwd(), "src", "commands"));
for (const command of commandsDir) {
    const commandExport = await import(path.join(process.cwd(), "src", "commands", command));

    const commandName = path.basename(command, ".ts")

    app.command(`/${commandName}`, commandExport.default)
}

app.start(process.env.PORT ?? 3000).then(async () => {
    console.log(`⚡ Bolt app is running in ${process.env.NODE_ENV} mode!`)

    if (process.env.NODE_ENV == "development" && process.env.NGROK_TOKEN != "NONE") {
        const ngrok = await import("@ngrok/ngrok");

        if (!process.env.NGROK_TOKEN) {
            app.stop();
            console.error("❌ You're running in development mode, but no NGROK_TOKEN was found in your .env file.")
            console.error("Not planning to use ngrok functionality? Set NGROK_TOKEN to NONE (case-sensitive!)")
            process.exit(1)
        }    

        try {
            const listener = await ngrok.forward({ 
                addr: process.env.PORT ?? 3000, 
                authtoken: process.env.NGROK_TOKEN, 
                domain: process.env.NGROK_DOMAIN ?? undefined
            })
            console.log(`Ngrok is proxying requests via ${listener.url()}!`)
        } catch (err) {
            app.stop();
            console.error("❌ Something went wrong while trying to forward to ngrok...")
            console.error(err)
            process.exit(1)
        }
    }
})