import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(dir, "../../drizzle");

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder });
console.log("Migrations complete.");
await client.end();
