import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- users: add password_hash ---
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash varchar(255)
    `);

    // --- categories: add icon, color ---
    await client.query(`
      ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS icon varchar(50),
        ADD COLUMN IF NOT EXISTS color varchar(20)
    `);

    // --- loans: add tenure_years ---
    await client.query(`
      ALTER TABLE loans
        ADD COLUMN IF NOT EXISTS tenure_years integer NOT NULL DEFAULT 5
    `);
    await client.query(`
      ALTER TABLE loans
        DROP COLUMN IF EXISTS outstanding_balance
    `);

    // --- incomes: add recurrence columns ---
    await client.query(`
      ALTER TABLE incomes
        ADD COLUMN IF NOT EXISTS recurrence_type varchar(20) NOT NULL DEFAULT 'one-time',
        ADD COLUMN IF NOT EXISTS occurrences integer NOT NULL DEFAULT 1
    `);

    // --- expenses: add recurrence columns ---
    await client.query(`
      ALTER TABLE expenses
        ADD COLUMN IF NOT EXISTS recurrence_type varchar(20) NOT NULL DEFAULT 'one-time',
        ADD COLUMN IF NOT EXISTS occurrences integer NOT NULL DEFAULT 1
    `);

    await client.query("COMMIT");
    console.log("Migration complete.");

    const res = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('users','loans','incomes','expenses')
      ORDER BY table_name, ordinal_position
    `);
    console.table(res.rows);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((e) => { console.error(e); process.exit(1); });
