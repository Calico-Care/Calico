/**
 * orgs-create
 * Purpose: Create a tenant organization in Stytch B2B and persist the mapping in Postgres.
 * Auth: Calico-ops only via CALICO_OPS_TOKEN.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import type { PoolClient } from 'https://deno.land/x/postgres@v0.17.2/mod.ts';
import { withConn } from '../_shared/db.ts';
import { stytchB2B } from '../_shared/stytch.ts';
import { corsHeaders } from '../_shared/cors.ts';

const CALICO_OPS_TOKEN = Deno.env.get('CALICO_OPS_TOKEN');

if (!CALICO_OPS_TOKEN) throw new Error('Missing CALICO_OPS_TOKEN');

const SLUG_RE = /^[a-z0-9._~-]{2,128}$/;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST')
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders,
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
          headers: { ...corsHeaders, 'content-type': 'application/json' },
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
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        }
      );

    if (!slug || typeof slug !== 'string' || !SLUG_RE.test(slug))
      return new Response(
        JSON.stringify({
          error: "Invalid 'slug' (2–128, allowed: a–z 0–9 . _ ~ -)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        }
      );

    const st = await stytchB2B.createOrganization(name, slug);
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
          ...corsHeaders,
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
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});
