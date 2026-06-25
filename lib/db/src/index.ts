import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { serializeDatabaseError } from "./dbErrors.js";
import {
  assertLifeOpsUsersSchema,
  getMigrationCount,
  hasLifeOpsUsersSchema,
} from "./schemaState.js";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function redactDatabaseUrl(url: string): string {
  return url.replace(/(postgresql:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
}

function poolSslConfig(connectionString: string): pg.PoolConfig["ssl"] {
  const lower = connectionString.toLowerCase();
  if (
    lower.includes("sslmode=require") ||
    lower.includes("sslmode=verify-full") ||
    lower.includes("sslmode=verify-ca") ||
    lower.includes("neon.tech")
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

const connectionString = process.env.DATABASE_URL;
const ssl = poolSslConfig(connectionString);

export const pool = new Pool({ connectionString, ssl });

pool.on("error", (error) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "PostgreSQL pool error",
      database: serializeDatabaseError(error),
    }),
  );
});

export const db = drizzle(pool, { schema });

export async function verifyDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1 AS ok");
    const migrationCount = await getMigrationCount(pool);
    const lifeopsSchema = await hasLifeOpsUsersSchema(pool);

    console.log(
      JSON.stringify({
        level: "info",
        msg: "Database connection verified",
        databaseUrl: redactDatabaseUrl(connectionString),
        sslEnabled: Boolean(ssl),
        migrationCount,
        lifeopsUsersSchema: lifeopsSchema,
      }),
    );

    await assertLifeOpsUsersSchema(pool);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "Database connection verification failed",
        databaseUrl: redactDatabaseUrl(connectionString),
        sslEnabled: Boolean(ssl),
        database: serializeDatabaseError(error),
      }),
    );
    throw error;
  } finally {
    client.release();
  }
}

export { serializeDatabaseError } from "./dbErrors.js";
export * from "./schema";
