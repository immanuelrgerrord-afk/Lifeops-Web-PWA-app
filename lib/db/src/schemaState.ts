import type pg from "pg";

export const LIFEOPS_USER_COLUMNS = [
  "id",
  "full_name",
  "mobile",
  "password_hash",
  "created_at",
  "updated_at",
] as const;

export async function usersTableExists(pool: pg.Pool): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('public.users') IS NOT NULL AS exists`,
  );
  return Boolean(rows[0]?.exists);
}

export async function getUsersColumnNames(pool: pg.Pool): Promise<string[]> {
  const { rows } = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
     ORDER BY ordinal_position`,
  );
  return rows.map((row) => row.column_name);
}

export async function hasLifeOpsUsersSchema(pool: pg.Pool): Promise<boolean> {
  if (!(await usersTableExists(pool))) return false;
  const columns = new Set(await getUsersColumnNames(pool));
  return LIFEOPS_USER_COLUMNS.every((column) => columns.has(column));
}

export async function assertLifeOpsUsersSchema(pool: pg.Pool): Promise<void> {
  if (!(await usersTableExists(pool))) {
    throw new Error("LifeOps schema missing: public.users table does not exist.");
  }

  const columns = await getUsersColumnNames(pool);
  const columnSet = new Set(columns);
  const missing = LIFEOPS_USER_COLUMNS.filter((column) => !columnSet.has(column));

  if (missing.length > 0) {
    throw new Error(
      `LifeOps schema mismatch on public.users. Missing columns: ${missing.join(", ")}. ` +
        `Found columns: ${columns.join(", ")}. ` +
        "Use a dedicated Neon database for LifeOps or run migrations against an empty database.",
    );
  }
}

export async function getMigrationCount(pool: pg.Pool): Promise<number> {
  try {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations`,
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}
