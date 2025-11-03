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

export async function withTenant<T>(
  orgId: string,
  cb: (conn: PoolClient) => Promise<T> | T,
  userId?: string
): Promise<T> {
  const conn = await pool.connect();
  try {
    await conn.queryObject("BEGIN");
    await conn.queryObject("SET LOCAL search_path = public");
    // SET LOCAL expects a string value; PostgreSQL will cast when reading via current_setting()
    await conn.queryObject("SET LOCAL app.org_id = $1", [orgId]);
    if (userId) {
      await conn.queryObject("SET LOCAL app.user_id = $1", [userId]);
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
