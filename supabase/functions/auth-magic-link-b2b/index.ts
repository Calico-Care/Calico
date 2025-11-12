/**
 * B2B Magic Link Authentication
 * Authenticates a Stytch B2B magic link token and returns a session JWT
 * Supports PKCE by retrieving code_verifier from database
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { pool } from "../_shared/db.ts";

const STYTCH_PROJECT_ID = Deno.env.get("STYTCH_PROJECT_ID");
const STYTCH_SECRET = Deno.env.get("STYTCH_SECRET");
const STYTCH_ENV = Deno.env.get("STYTCH_ENV") || "test";

function getStytchBaseUrl(): string {
  return STYTCH_ENV === "live"
    ? "https://api.stytch.com/v1"
    : "https://test.stytch.com/v1";
}

function getStytchAuthHeader(): string {
  if (!STYTCH_PROJECT_ID || !STYTCH_SECRET) {
    throw new Error("B2B API credentials not configured");
  }
  return `Basic ${btoa(`${STYTCH_PROJECT_ID}:${STYTCH_SECRET}`)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const { token, email, organization_id, stytch_organization_id, code_verifier } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine Stytch org ID
    let actualStytchOrgId = stytch_organization_id;

    if (!actualStytchOrgId && organization_id && email) {
      const conn = await pool.connect();
      try {
        // If organization_id is a UUID (Calico org ID), look up the Stytch org ID
        if (organization_id.includes("-") && organization_id.length === 36) {
          const orgResult = await conn.queryObject<{ stytch_organization_id: string }>(`
            SELECT stytch_organization_id FROM organizations WHERE id = $1
          `, [organization_id]);

          if (orgResult.rows.length > 0) {
            actualStytchOrgId = orgResult.rows[0].stytch_organization_id;
          }
        } else {
          actualStytchOrgId = organization_id;
        }
      } finally {
        conn.release();
      }
    }

    // If code_verifier not provided and we have email + org_id, try to retrieve from database
    let verifier = code_verifier;
    if (!verifier && email && actualStytchOrgId) {
      const conn = await pool.connect();
      try {
        const result = await conn.queryObject<{ code_verifier: string }>(`
          SELECT code_verifier FROM pkce_verifiers
          WHERE email = $1 AND organization_id = $2 AND expires_at > now()
          ORDER BY expires_at DESC LIMIT 1
        `, [email.toLowerCase(), actualStytchOrgId]);

        if (result.rows.length > 0) {
          verifier = result.rows[0].code_verifier;
        }
      } finally {
        conn.release();
      }
    }

    // Authenticate with Stytch B2B API
    const stytchUrl = `${getStytchBaseUrl()}/b2b/magic_links/authenticate`;
    const authHeader = getStytchAuthHeader();

    const requestBody: Record<string, unknown> = {
      magic_links_token: token,
      session_duration_minutes: 60,
    };

    if (verifier) {
      requestBody.pkce_code_verifier = verifier;
    }

    const response = await fetch(stytchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete used PKCE verifier
    if (verifier && email && actualStytchOrgId) {
      const conn = await pool.connect();
      try {
        await conn.queryObject(`
          DELETE FROM pkce_verifiers 
          WHERE email = $1 AND organization_id = $2
        `, [email.toLowerCase(), actualStytchOrgId]);
      } finally {
        conn.release();
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("B2B magic link auth error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

