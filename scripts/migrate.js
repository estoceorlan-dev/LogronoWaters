import "./env.js";
import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export async function migrate(
  client,
  directory = new URL("../db/migrations/", import.meta.url),
) {
  await client.query("SELECT pg_advisory_lock(746209113)");
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (await readdir(directory))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const name of files) {
      const sql = (await readFile(new URL(name, directory), "utf8")).replace(
        /\r\n/g,
        "\n",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      const {
        rows: [existing],
      } = await client.query(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(
            `Applied migration ${name} changed. Create a new migration instead.`,
          );
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1,$2)",
          [name, checksum],
        );
        await client.query("COMMIT");
        console.log(`Applied ${name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(746209113)");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    console.error(
      "Set DATABASE_URL_UNPOOLED to the direct Postgres connection string.",
    );
    process.exitCode = 1;
  } else if (new URL(connectionString).hostname.includes("-pooler")) {
    console.error(
      "Migrations require a direct connection, without -pooler in the hostname.",
    );
    process.exitCode = 1;
  } else {
    const client = new pg.Client({
      connectionString,
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      await migrate(client);
      console.log("Database is up to date.");
    } catch (error) {
      console.error(`Migration failed (${error.code || error.message}).`);
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  }
}
