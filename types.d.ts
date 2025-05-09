declare global {
    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: 'development' | 'production';
            PORT?: string;
            SIGNING_SECRET: string;
            APP_TOKEN: string;

            NGROK_TOKEN: string | undefined;
            NGROK_DOMAIN: string | undefined;
        }
    }
}

export {};