import { Pool, PoolClient } from "https://deno.land/x/postgres@v0.17.2/mod.ts";

const DB_URL = Deno.env.get("APP_DB_URL");
if (!DB_URL) throw new Error("Missing APP_DB_URL");

export const pool = new Pool(DB_URL, 3, true);

export async function withConn<T>(
  cb: (conn: PoolClient) => Promise<T> | T
): Promise<T> {
  const conn = await pool.connect();
  try {
    return await cb(conn);
  } finally {
    conn.release();
  }
}

/**
 * Set the organization context for RLS using a parameterized query
 * Uses set_config() which supports parameters and sets the value locally to the transaction
 * @param conn - Database connection client
 * @param orgId - Organization ID (UUID)
 */
export async function setOrgContext(conn: PoolClient, orgId: string): Promise<void> {
  await conn.queryObject(
    `SELECT set_config('app.org_id', $1, true)`,
    [orgId]
  );
}

/**
 * Execute a callback within a transaction, handling BEGIN/COMMIT/ROLLBACK lifecycle
 * ROLLBACK is only attempted if BEGIN succeeded, preventing misleading error messages
 * @param conn - Database connection client
 * @param cb - Callback to execute within the transaction
 * @returns Result of the callback
 */
export async function withTransaction<T>(
  conn: PoolClient,
  cb: (conn: PoolClient) => Promise<T> | T
): Promise<T> {
  let transactionStarted = false;
  try {
    await conn.queryObject("BEGIN");
    transactionStarted = true;
    const result = await cb(conn);
    await conn.queryObject("COMMIT");
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.queryObject("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Failed to rollback transaction:", rollbackErr);
      }
    }
    throw error;
  }
}

export async function withTenant<T>(
  orgId: string,
  cb: (conn: PoolClient) => Promise<T> | T,
  userId?: string
): Promise<T> {
  const conn = await pool.connect();
  try {
    await conn.queryObject("BEGIN");
    await conn.queryObject("SET LOCAL search_path = public");
    // SET LOCAL requires literal value, not parameterized (orgId is safe as it's validated UUID)
    await conn.queryObject(`SET LOCAL app.org_id = '${orgId.replace(/'/g, "''")}'`);
    if (userId) {
      await conn.queryObject(`SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`);
    }
    const res = await cb(conn);
    await conn.queryObject("COMMIT");
    return res;
  } catch (e) {
    try {
      await conn.queryObject("ROLLBACK");
    } catch (rollbackErr) {
      console.error("rollback failed", rollbackErr);
    }
    throw e;
  } finally {
    conn.release();
  }
}
