import { Pool, PoolClient } from 'https://deno.land/x/postgres@v0.17.2/mod.ts';

const DB_URL = Deno.env.get('APP_DB_URL');
if (!DB_URL) throw new Error('Missing APP_DB_URL');

export const pool = new Pool(DB_URL, 3, true);

export async function withConn<T>(cb: (client: PoolClient) => Promise<T>): Promise<T> {
  const conn = await pool.connect();
  try {
    return await cb(conn);
  } finally {
    conn.release();
  }
}

export async function withTenant<T>(
  orgId: string,
  cb: (client: PoolClient) => Promise<T>,
  userId?: string
): Promise<T> {
  const conn = await pool.connect();
  try {
    await conn.queryArray`begin`;
    await conn.queryArray`set local search_path = public`;
    await conn.queryArray`set local app.org_id = ${orgId}::uuid`;
    if (userId) await conn.queryArray`set local app.user_id = ${userId}::uuid`;
    const res = await cb(conn);
    await conn.queryArray`commit`;
    return res;
  } catch (e) {
    try {
      await conn.queryArray`rollback`;
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}
