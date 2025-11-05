/**
 * staff-invite-admin
 * Purpose: Calico admin invites an org admin into a Stytch B2B org.
 * Auth: Calico-ops only via CALICO_OPS_TOKEN.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import type { PoolClient } from "https://deno.land/x/postgres@v0.17.2/mod.ts";
import { withConn, withTenant } from "../_shared/db.ts";
import { stytchB2B } from "../_shared/stytch.ts";

const CALICO_OPS_TOKEN = Deno.env.get("CALICO_OPS_TOKEN");

if (!CALICO_OPS_TOKEN) throw new Error("Missing CALICO_OPS_TOKEN");

// Email validation regex (basic)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteRequest {
  org_id: string;
  email: string;
  name?: string;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
      });
    }

    // Check authorization
    const auth = req.headers.get("authorization") || "";
    const token = (/^Bearer\s+(.+)$/i.exec(auth)?.[1] || "").trim();
    if (!token || token !== CALICO_OPS_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
        }),
        {
          status: 401,
        }
      );
    }

    // Parse and validate request body
    const body: InviteRequest = await req.json();
    const { org_id, email, name } = body;

    if (!org_id || typeof org_id !== "string") {
      return new Response(
        JSON.stringify({
          error: "Invalid 'org_id'",
        }),
        {
          status: 400,
        }
      );
    }

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return new Response(
        JSON.stringify({
          error: "Invalid 'email'",
        }),
        {
          status: 400,
        }
      );
    }

    // Get Stytch organization ID from database using SECURITY DEFINER function
    const orgResult = await withConn(
      (c: PoolClient) =>
        c.queryObject<{
          id: string;
          name: string;
          stytch_organization_id: string;
          created_at: Date;
        }>(
          `SELECT id, name, stytch_organization_id, created_at
           FROM admin.get_organization($1::uuid)`,
          [org_id]
        )
    );

    if (orgResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Organization not found",
        }),
        {
          status: 404,
        }
      );
    }

    const stytch_organization_id = orgResult.rows[0].stytch_organization_id;
    if (!stytch_organization_id) {
      return new Response(
        JSON.stringify({
          error: "Organization missing Stytch mapping",
        }),
        {
          status: 500,
        }
      );
    }

    // Invite member via Stytch B2B API
    // Assign 'stytch_admin' role so org admin can invite clinicians
    const stytchResponse = await stytchB2B.inviteMember(
      stytch_organization_id,
      email,
      name,
      ["stytch_admin"]
    );

    // member_id is always present at the top level of the response
    const stytch_member_id = stytchResponse.member_id;
    const stytch_invitation_id = stytch_member_id; // Stytch returns member_id on invite

    if (!stytch_member_id) {
      throw new Error("Missing member_id from Stytch invite response");
    }

    // Insert invitation record using withTenant to satisfy RLS
    const invitationResult = await withTenant(
      org_id,
      (c: PoolClient) =>
        c.queryObject<{ id: string }>(
          `INSERT INTO invitations (
            org_id,
            email,
            role,
            stytch_invitation_id,
            status,
            invited_by
          )
          VALUES ($1, $2, 'org_admin', $3, 'pending', NULL)
          RETURNING id`,
          [org_id, email, stytch_member_id]
        )
    );

    const invitation_id = invitationResult.rows[0]?.id;

    return new Response(
      JSON.stringify({
        ok: true,
        invitation_id,
        stytch_invitation_id: stytch_member_id,
        email,
      }),
      {
        headers: {
          "content-type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error("Error in staff-invite-admin:", e);
    const errorMessage =
      e instanceof Error ? e.message : "Failed to invite org admin";
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
      }
    );
  }
});
