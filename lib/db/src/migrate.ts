/**
 * Production migration entrypoint: baseline push-provisioned LifeOps databases, then
 * apply pending versioned migrations via drizzle-kit (non-interactive).
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  assertLifeOpsUsersSchema,
  hasLifeOpsUsersSchema,
  usersTableExists,
} from "./schemaState.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, "..");
const migrationsFolder = path.join(packageRoot, "drizzle");

function poolSslConfig(connectionString: string) {
  const lower = connectionString.toLowerCase();
  if (
    lower.includes("sslmode=require") ||
    lower.includes("sslmode=verify-full") ||
    lower.includes("sslmode=verify-ca") ||
    lower.includes("neon.tech")
  ) {
    return { rejectUnauthorized: false as const };
  }
  return undefined;
}

function migrationFiles(): string[] {
  return readdirSync(migrationsFolder)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function migrationHash(tag: string): string {
  const file = path.join(migrationsFolder, `${tag}.sql`);
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

async function ensureBaseline(pool: Pool): Promise<void> {
  if (!(await usersTableExists(pool))) return;

  if (!(await hasLifeOpsUsersSchema(pool))) {
    throw new Error(
      "public.users exists but is not a LifeOps schema (expected mobile, full_name). " +
        "Point DATABASE_URL at a dedicated LifeOps Neon database.",
    );
  }

  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows: applied } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations`,
  );
  if (Number(applied[0]?.count ?? 0) > 0) return;

  const files = migrationFiles();
  if (files.length === 0) return;

  console.log("Baseline: LifeOps schema detected — marking committed migrations as applied.");
  const now = Date.now();
  for (const file of files) {
    const tag = file.replace(/\.sql$/, "");
    await pool.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [migrationHash(tag), now],
    );
  }
}

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: poolSslConfig(databaseUrl),
  });
  try {
    await ensureBaseline(pool);
  } finally {
    await pool.end();
  }

  execSync("drizzle-kit migrate --config ./drizzle.config.ts", {
    cwd: packageRoot,
    stdio: "inherit",
    env: process.env,
  });

  const verifyPool = new Pool({
    connectionString: databaseUrl,
    ssl: poolSslConfig(databaseUrl),
  });
  try {
    await assertLifeOpsUsersSchema(verifyPool);
  } finally {
    await verifyPool.end();
  }

  console.log("Migrations complete.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
