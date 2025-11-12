/**
 * Consumer Magic Link Authentication
 * Authenticates a Stytch Consumer magic link token and returns a session JWT
 * Supports PKCE by retrieving code_verifier from database
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { pool } from "../_shared/db.ts";

const STYTCH_CONSUMER_PROJECT_ID = Deno.env.get("STYTCH_CONSUMER_PROJECT_ID");
const STYTCH_CONSUMER_SECRET = Deno.env.get("STYTCH_CONSUMER_SECRET");
const STYTCH_ENV = Deno.env.get("STYTCH_ENV") || "test";

function getStytchBaseUrl(): string {
  return STYTCH_ENV === "live"
    ? "https://api.stytch.com/v1"
    : "https://test.stytch.com/v1";
}

function getStytchConsumerAuthHeader(): string {
  if (!STYTCH_CONSUMER_PROJECT_ID || !STYTCH_CONSUMER_SECRET) {
    throw new Error("Consumer API credentials not configured");
  }
  return `Basic ${btoa(`${STYTCH_CONSUMER_PROJECT_ID}:${STYTCH_CONSUMER_SECRET}`)}`;
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
    const { token, email, code_verifier } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If code_verifier not provided and email is provided, try to retrieve from database
    let verifier = code_verifier;
    if (!verifier && email) {
      const conn = await pool.connect();
      try {
        const result = await conn.queryObject<{ code_verifier: string }>(`
          SELECT code_verifier FROM pkce_verifiers
          WHERE email = $1 AND organization_id = '00000000-0000-0000-0000-000000000000'
          AND expires_at > now()
          ORDER BY expires_at DESC LIMIT 1
        `, [email.toLowerCase()]);

        if (result.rows.length > 0) {
          verifier = result.rows[0].code_verifier;
        }
      } finally {
        conn.release();
      }
    }

    // Authenticate with Stytch Consumer API
    const stytchUrl = `${getStytchBaseUrl()}/magic_links/authenticate`;
    const authHeader = getStytchConsumerAuthHeader();

    const requestBody: Record<string, unknown> = {
      token,
      session_duration_minutes: 60,
    };

    if (verifier) {
      requestBody.code_verifier = verifier;
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
    if (verifier && email) {
      const conn = await pool.connect();
      try {
        await conn.queryObject(`
          DELETE FROM pkce_verifiers 
          WHERE email = $1 AND organization_id = '00000000-0000-0000-0000-000000000000'
        `, [email.toLowerCase()]);
      } finally {
        conn.release();
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Consumer magic link auth error:", error);
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

