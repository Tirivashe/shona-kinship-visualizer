import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const globalDatabase = globalThis as typeof globalThis & {
  shonaFamilyPostgresPool?: Pool;
};

export const pool =
  globalDatabase.shonaFamilyPostgresPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalDatabase.shonaFamilyPostgresPool = pool;
}

export const db = drizzle({ client: pool });
