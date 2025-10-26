/**
 * orgs-create
 * Purpose: Create a tenant organization in Stytch B2B and persist the mapping in Postgres.
 * Auth: Calico-ops only via a static bearer token (CALICO_OPS_TOKEN). No tenant RLS context required.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { withConn } from '../_shared/db.ts';

const STYTCH_PROJECT_ID = Deno.env.get('STYTCH_PROJECT_ID')!;
const STYTCH_SECRET = Deno.env.get('STYTCH_SECRET')!;
const STYTCH_ENV_RAW = Deno.env.get('STYTCH_ENV') ?? 'test';
const STYTCH_ENV = STYTCH_ENV_RAW === 'live' ? 'live' : 'test';
const CALICO_OPS_TOKEN = Deno.env.get('CALICO_OPS_TOKEN')!;

const base = STYTCH_ENV === 'live' ? 'https://api.stytch.com/v1' : 'https://test.stytch.com/v1';
const SLUG_RE = /^[a-z0-9._~-]{2,128}$/;

async function createStytchOrg(name: string, slug: string) {
  // Minimal Stytch B2B org creation. Throws on non-2xx.
  const res = await fetch(`${base}/b2b/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(`${STYTCH_PROJECT_ID}:${STYTCH_SECRET}`),
    },
    body: JSON.stringify({
      organization_name: name,
      organization_slug: slug,
    }),
  });
  if (!res.ok) throw new Error(`Stytch error: ${res.status} ${await res.text()}`);
  return res.json();
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    // Ops-only authorization: static bearer check.
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ') || auth.split(' ')[1] !== CALICO_OPS_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    // Validate input.
    const { name, slug } = await req.json();
    if (!name || typeof name !== 'string') {
      return new Response(JSON.stringify({ error: "Invalid 'name'" }), {
        status: 400,
      });
    }
    if (!slug || typeof slug !== 'string' || !SLUG_RE.test(slug)) {
      return new Response(
        JSON.stringify({
          error: "Invalid 'slug' (2–128, allowed: a–z 0–9 . _ ~ -)",
        }),
        { status: 400 }
      );
    }

    // Create org in Stytch and extract its ID.
    const st = await createStytchOrg(name, slug);
    const stytch_organization_id: string = st.organization?.organization_id ?? st.organization_id;
    if (!stytch_organization_id) throw new Error('Missing organization_id from Stytch');

    // Idempotent insert by Stytch ID; reuse existing if present.
    const row = await withConn(async (c) => {
      const existing = await c.queryObject<{ id: string }>`
        select id from public.organizations where stytch_organization_id = ${stytch_organization_id} limit 1
      `;
      if (existing.rows[0]) return existing.rows[0];

      const inserted = await c.queryObject<{ id: string }>`
        insert into public.organizations (id, name, stytch_organization_id, created_at)
        values (gen_random_uuid(), ${name}, ${stytch_organization_id}, now())
        returning id
      `;
      return inserted.rows[0];
    });

    return new Response(
      JSON.stringify({
        ok: true,
        org_id: row.id,
        stytch_organization_id,
        slug,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 400,
    });
  }
});
