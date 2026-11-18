import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { HttpError } from "./errors.js";

let pool;
export function getDatabase() {
  if (!process.env.DATABASE_URL)
    throw new HttpError(
      503,
      "Database is not configured. Contact the station administrator.",
    );
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 15000,
    });
    pool.on("error", () =>
      console.error("Unexpected idle database connection error"),
    );
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}

export async function transaction(db, fn) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
