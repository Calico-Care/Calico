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

/**
 * Set the user context for RLS using a parameterized query
 * Uses set_config() which supports parameters and sets the value locally to the transaction
 * @param conn - Database connection client
 * @param userId - User ID (UUID)
 */
export async function setUserContext(conn: PoolClient, userId: string): Promise<void> {
  await conn.queryObject(
    `SELECT set_config('app.user_id', $1, true)`,
    [userId]
  );
}

/**
 * Execute a callback within a transaction with tenant context
 * Sets organization context (and optionally user context) for RLS
 * Uses parameterized queries for security
 * @param orgId - Organization ID (UUID)
 * @param cb - Callback to execute within the transaction
 * @param userId - Optional user ID (UUID) to set user context
 * @returns Result of the callback
 */
export async function withTenant<T>(
  orgId: string,
  cb: (conn: PoolClient) => Promise<T> | T,
  userId?: string
): Promise<T> {
  const conn = await pool.connect();
  try {
    const result = await withTransaction(conn, async (conn) => {
      await conn.queryObject("SET LOCAL search_path = public");
      await setOrgContext(conn, orgId);
      if (userId) {
        await setUserContext(conn, userId);
      }
      return await cb(conn);
    });
    
    return result;
  } finally {
    conn.release();
  }
}
