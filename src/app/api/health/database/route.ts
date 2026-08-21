import { sql } from "drizzle-orm";

import { db } from "@/db";

import { familyApiError } from "../../family-api";

export async function GET() {
  try {
    const result = await db.execute<{
      database: string;
      serverTime: Date;
      version: string;
    }>(sql`
      select
        current_database() as database,
        now() as "serverTime",
        version() as version
    `);
    return Response.json({ status: "ok", ...result.rows[0] });
  } catch (cause) {
    return familyApiError(cause);
  }
}
