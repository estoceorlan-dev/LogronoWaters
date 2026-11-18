import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { migrate } from "../../scripts/migrate.js";

// Every test run uses a fresh database/schema, never production station tables.
export async function testDatabase() {
  if (process.env.TEST_DATABASE_URL) {
    const schema = `test_${randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
      max: 5,
    });
    const client = await pool.connect();
    try {
      await migrate(client);
      await migrate(client);
    } finally {
      client.release();
    }
    return {
      db: pool,
      close: async () => {
        await pool.end();
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        await admin.end();
      },
    };
  }
  const engine = new PGlite();
  const query = async (sql, args) => {
    const result =
      !args?.length && sql.includes(";")
        ? (await engine.exec(sql)).at(-1)
        : await engine.query(sql, args);
    return {
      ...result,
      rowCount: result.affectedRows ?? result.rows?.length ?? 0,
    };
  };
  let tail = Promise.resolve();
  const connect = async () => {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    return { query, release };
  };
  const db = {
    connect,
    query: async (...args) => {
      const c = await connect();
      try {
        return await c.query(...args);
      } finally {
        c.release();
      }
    },
  };
  const client = await db.connect();
  try {
    await migrate(client);
    await migrate(client);
  } finally {
    client.release();
  }
  return { db, close: () => engine.close() };
}
