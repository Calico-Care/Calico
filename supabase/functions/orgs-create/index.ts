/**
 * orgs-create
 * Purpose: Create a tenant organization in Stytch B2B and persist the mapping in Postgres.
 * Auth: Calico-ops only via CALICO_OPS_TOKEN.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import type { PoolClient } from 'https://deno.land/x/postgres@v0.17.2/mod.ts';
import { withConn } from '../_shared/db.ts';

const STYTCH_PROJECT_ID = Deno.env.get('STYTCH_PROJECT_ID');
const STYTCH_SECRET = Deno.env.get('STYTCH_SECRET');
const STYTCH_ENV = Deno.env.get('STYTCH_ENV'); // 'live' or 'test'
const CALICO_OPS_TOKEN = Deno.env.get('CALICO_OPS_TOKEN');

if (!STYTCH_PROJECT_ID) throw new Error('Missing STYTCH_PROJECT_ID');
if (!STYTCH_SECRET) throw new Error('Missing STYTCH_SECRET');
if (STYTCH_ENV !== 'live' && STYTCH_ENV !== 'test') {
  throw new Error("Invalid STYTCH_ENV (expected 'live' or 'test')");
}
if (!CALICO_OPS_TOKEN) throw new Error('Missing CALICO_OPS_TOKEN');

const base = STYTCH_ENV === 'live' ? 'https://api.stytch.com/v1' : 'https://test.stytch.com/v1';
const SLUG_RE = /^[a-z0-9._~-]{2,128}$/;

async function createStytchOrg(name: string, slug: string) {
  const res = await fetch(`${base}/b2b/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${STYTCH_PROJECT_ID}:${STYTCH_SECRET}`)}`,
    },
    body: JSON.stringify({
      organization_name: name,
      organization_slug: slug,
    }),
  });
  if (!res.ok) throw new Error(`Stytch error: ${res.status} ${await res.text()}`);
  return res.json();
}

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST')
      return new Response('Method Not Allowed', {
        status: 405,
      });

    const auth = req.headers.get('authorization') || '';
    const token = (/^Bearer\s+(.+)$/i.exec(auth)?.[1] || '').trim();
    if (!token || token !== CALICO_OPS_TOKEN)
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
        }),
        {
          status: 401,
        }
      );

    const { name, slug } = await req.json();
    if (!name || typeof name !== 'string')
      return new Response(
        JSON.stringify({
          error: "Invalid 'name'",
        }),
        {
          status: 400,
        }
      );

    if (!slug || typeof slug !== 'string' || !SLUG_RE.test(slug))
      return new Response(
        JSON.stringify({
          error: "Invalid 'slug' (2–128, allowed: a–z 0–9 . _ ~ -)",
        }),
        {
          status: 400,
        }
      );

    const st = await createStytchOrg(name, slug);
    const stytch_organization_id = st.organization?.organization_id ?? st.organization_id;
    if (!stytch_organization_id) throw new Error('Missing organization_id from Stytch');
    const q = await withConn(
      (c: PoolClient) => c.queryObject`
        select admin.create_organization(${name}, ${stytch_organization_id}) as id
      `
    );

    return new Response(
      JSON.stringify({
        ok: true,
        org_id: q.rows[0].id,
        stytch_organization_id,
        slug,
      }),
      {
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  } catch (e) {
    console.error('Error in orgs-create:', e);
    return new Response(
      JSON.stringify({
        error: 'Failed to create organization',
      }),
      {
        status: 500,
      }
    );
  }
});
