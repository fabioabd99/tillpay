import { existsSync } from "node:fs";

// load .env before anything imports the db module
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
