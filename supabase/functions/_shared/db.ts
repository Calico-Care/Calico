import { Pool, PoolClient } from 'https://deno.land/x/postgres@v0.17.2/mod.ts';

const DB_URL = Deno.env.get('SUPABASE_DB_URL');
if (!DB_URL) throw new Error('Missing SUPABASE_DB_URL');

export const pool = new Pool(DB_URL, 3, true);

// Non-tenant work (admin/ops)
export async function withConn<T>(cb: (client: PoolClient) => Promise<T>): Promise<T> {
  const conn = await pool.connect();
  try {
    return await cb(conn);
  } finally {
    conn.release();
  }
}

// Tenant-scoped work (RLS active)
export async function withTenant<T>(
  orgId: string,
  cb: (client: PoolClient) => Promise<T>
): Promise<T> {
  const conn = await pool.connect();
  try {
    await conn.queryArray`begin`;
    await conn.queryArray`set local app.org_id = ${orgId}::uuid`;
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
