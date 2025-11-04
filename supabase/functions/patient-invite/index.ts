import { corsHeaders } from "@/cors.ts";
import { withTenant } from "@/db.ts";
import { authenticateStaff, StaffAuthError } from "@/auth.ts";
import { stytchConsumer } from "@/stytch.ts";

interface InviteRequest {
  email: string;
}


interface InviteResponse {
  ok: true;
  invitation_id: string;
  warning?: string;
}


export async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
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

    // Authenticate staff user
    const authResult = await authenticateStaff(sessionJwt);

    // Require clinician or org_admin role
    if (authResult.role !== 'clinician' && authResult.role !== 'org_admin') {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: InviteRequest = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create invitation record using tenant context
    // This must succeed before sending the magic link email to avoid sending emails
    // when database operations fail. The transaction ensures atomicity.
    const result = await withTenant(authResult.org_id, async (conn) => {
      // Atomically insert or return existing invitation using INSERT with error handling
      // The partial unique index inv_pending_once_per_role on (org_id, email, role) WHERE status = 'pending'
      // prevents duplicate pending invitations. PostgreSQL's ON CONFLICT doesn't support partial indexes,
      // so we catch unique violations and query for the existing row.
      try {
        const inviteResult = await conn.queryObject<{ invitation_id: string }>(
          `INSERT INTO invitations (org_id, email, role, invited_by, status)
           VALUES ($1, $2, 'patient', $3, 'pending')
           RETURNING id as invitation_id`,
          [authResult.org_id, email, authResult.user_id]
        );

        if (inviteResult.rows && inviteResult.rows.length > 0) {
          return { invitation_id: inviteResult.rows[0].invitation_id };
        }
      } catch (error) {
        // Handle unique constraint violation from partial index (race condition)
        if (
          error instanceof Error &&
          (error.message.includes("unique") ||
            error.message.includes("duplicate") ||
            error.message.includes("23505"))
        ) {
          const existingInvite = await conn.queryObject<{ invitation_id: string }>(
            "SELECT id as invitation_id FROM invitations WHERE org_id = $1 AND email = $2 AND role = 'patient' AND status = 'pending'",
            [authResult.org_id, email]
          );

          if (existingInvite.rows && existingInvite.rows.length > 0) {
            return { invitation_id: existingInvite.rows[0].invitation_id };
          }
        }
        throw error;
      }

      throw new Error("Failed to create or retrieve invitation");
    });

    // Send magic link via Stytch Consumer API after database operation succeeds
    // Wrap in try/catch to handle email failures without rolling back the DB record
    // The invitation record is already committed, so email failures can be retried
    let emailError: Error | null = null;
    try {
      await stytchConsumer.sendMagicLink(email);
    } catch (error) {
      emailError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `Failed to send magic link email for invitation ${result.invitation_id}:`,
        emailError.message
      );
      // Don't throw - the invitation record is already committed and can be retried
    }

    const response: InviteResponse = {
      ok: true,
      invitation_id: result.invitation_id,
    };

    // If email failed, return success but include a warning in the response
    // This allows the caller to retry sending the email if needed
    if (emailError) {
      return new Response(
        JSON.stringify({
          ...response,
          warning: "Invitation created but email delivery failed. Please retry sending the invitation.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Patient invite error:", error);

    let status = 500;
    let message = "Internal server error";

    if (error instanceof StaffAuthError) {
      switch (error.code) {
        case "INVALID_SESSION":
          status = 401;
          message = "Invalid session";
          break;
        case "ORGANIZATION_NOT_FOUND":
        case "NO_INVITATION":
          status = 500;
          message = "Authentication state error";
          break;
        default:
          status = 500;
          message = "Internal server error";
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
}
