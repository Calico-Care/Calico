import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "@/cors.ts";
import { withConn } from "@/db.ts";
import { stytchConsumer } from "@/stytch.ts";

type AuthResponse =
  | {
      kind: "single";
      user_id: string;
      org_id: string;
      org_ids?: never;
      role: "patient";
      email: string;
    }
  | {
      kind: "multi";
      user_id: string;
      org_ids: string[];
      org_id?: never;
      role: "patient";
      email: string;
    };

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Extract session JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sessionJwt = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify session with Stytch Consumer API
    const authResponse = await stytchConsumer.authenticateSession(sessionJwt);
    if (!authResponse.session || !authResponse.user_id) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stytchUserId = authResponse.user_id;
    // Note: Consumer API doesn't return email in authenticate response
    // We'll get it from the users table or invitations later

    // DB operations: synchronize state
    const result = await withConn(async (conn) => {
      // First, check if user exists and get their email
      const userResult = await conn.queryObject<{ user_id: string; email: string }>(
        "SELECT id as user_id, email FROM users WHERE stytch_user_id = $1",
        [stytchUserId]
      );

      let userId: string;
      let email: string;

      if (userResult.rows.length === 0) {
        // Fetch email from Stytch since authenticate session response omits it
        const stytchUser = await stytchConsumer.getUser(stytchUserId);
        const primaryEmail =
          stytchUser.user.email_addresses.find((addr) => addr.primary)
            ?.email_address ?? stytchUser.user.email_addresses[0]?.email_address;

        if (!primaryEmail) {
          throw new Error(
            "No email address found for Stytch user. User may not have completed email verification."
          );
        }

        // User doesn't exist - look for pending invitation to get email
        const inviteResult = await conn.queryObject<{ email: string }>(
          "SELECT email FROM invitations WHERE email = $1 AND role = 'patient' AND status = 'pending'",
          [primaryEmail]
        );

        if (inviteResult.rows.length === 0) {
          throw new Error("No pending patient invitation found for this user");
        }

        email = inviteResult.rows[0].email;

        // Create user
        const newUserResult = await conn.queryObject<{ user_id: string }>(
          "INSERT INTO users (stytch_user_id, email) VALUES ($1, $2) RETURNING id as user_id",
          [stytchUserId, email]
        );
        userId = newUserResult.rows[0].user_id;
      } else {
        userId = userResult.rows[0].user_id;
        email = userResult.rows[0].email;
      }

      // Check existing memberships
      const membershipResult = await conn.queryObject<{ org_id: string; role: string }>(
        "SELECT org_id, role FROM memberships WHERE user_id = $1 AND role = 'patient'",
        [userId]
      );

      if (membershipResult.rows.length === 0) {
        // No membership - look for pending invitation
        const inviteResult = await conn.queryObject<{ org_id: string; id: string }>(
          "SELECT org_id, id FROM invitations WHERE email = $1 AND role = 'patient' AND status = 'pending'",
          [email]
        );

        if (inviteResult.rows.length === 0) {
          throw new Error("No pending patient invitation found");
        }

        const orgId = inviteResult.rows[0].org_id;
        const invitationId = inviteResult.rows[0].id;


        // Begin transaction
        try {
          await conn.queryObject("BEGIN");
          
          // Create membership
          await conn.queryObject(
            "INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, 'patient', 'active')",
            [orgId, userId]
          );

          // Create patient record (minimal initial data)
          await conn.queryObject(
            "INSERT INTO patients (org_id, user_id) VALUES ($1, $2)",
            [orgId, userId]
          );

          // Mark invitation as accepted
          await conn.queryObject(
            "UPDATE invitations SET status = 'accepted' WHERE id = $1",
            [invitationId]
          );
          
          await conn.queryObject("COMMIT");
        } catch (error) {
          await conn.queryObject("ROLLBACK");
          throw error;
        }


        return {
          kind: "single",
          user_id: userId,
          org_id: orgId,
          role: "patient" as const,
          email,
        };
      } else if (membershipResult.rows.length === 1) {
        // Single org membership
        const { org_id, role } = membershipResult.rows[0];
        return {
          kind: "single",
          user_id: userId,
          org_id,
          role: role as "patient",
          email,
        };
      } else {
        // Multi-org patient - return array of org_ids
        const orgIds = membershipResult.rows.map((row) => row.org_id);
        return {
          kind: "multi",
          user_id: userId,
          org_ids: orgIds,
          role: "patient" as const,
          email,
        };
      }
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auth verification error:", error);

    let status = 500;
    let message = "Internal server error";

    if (error instanceof Error) {
      if (error.message.includes("No pending patient invitation")) {
        status = 404;
        message = error.message;
      } else if (error.message.includes("Invalid session")) {
        status = 401;
        message = "Invalid session";
      }
    }

    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
