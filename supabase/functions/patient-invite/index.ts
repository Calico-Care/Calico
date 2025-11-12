import { corsHeaders } from "@/cors.ts";
import { withTenant, withConn } from "@/db.ts";
import { authenticateStaff, StaffAuthError } from "@/auth.ts";
import { stytchConsumer } from "@/stytch.ts";

interface InviteRequest {
  email: string;
  legal_name?: string; // Optional: Patient legal name provided by clinician
  dob?: string; // Optional: Patient date of birth (ISO 8601 format: YYYY-MM-DD)
}


interface InviteResponse {
  ok: true;
  invitation_id: string;
  warning?: string;
  email_error?: string; // Error message if email sending failed (for debugging)
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
    const { email, legal_name, dob } = body;

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

    // Validate date of birth format if provided (ISO 8601: YYYY-MM-DD)
    if (dob !== undefined && dob !== null) {
      if (typeof dob !== "string") {
        return new Response(
          JSON.stringify({ error: "Invalid date of birth format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(dob)) {
        return new Response(
          JSON.stringify({ error: "Date of birth must be in YYYY-MM-DD format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      // Validate it's a valid date
      const dateObj = new Date(dob);
      if (isNaN(dateObj.getTime()) || dateObj.toISOString().split('T')[0] !== dob) {
        return new Response(
          JSON.stringify({ error: "Invalid date of birth" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create invitation record using tenant context
    // The invitation record is created first, then the magic link is sent outside the transaction
    // This ensures that if email sending fails, the transaction isn't aborted
    const result = await withTenant(authResult.org_id, async (conn) => {
      // Atomically insert or return existing invitation using INSERT with error handling
      // The partial unique index inv_pending_once_per_role on (org_id, email, role) WHERE status = 'pending'
      // prevents duplicate pending invitations. PostgreSQL's ON CONFLICT doesn't support partial indexes,
      // so we use a SAVEPOINT to handle unique violations without aborting the entire transaction.
      // Store optional patient data (legal_name, dob) in metadata JSONB field
      const metadata: Record<string, unknown> = {};
      if (legal_name !== undefined && legal_name !== null) {
        metadata.legal_name = legal_name;
      }
      if (dob !== undefined && dob !== null) {
        metadata.dob = dob;
      }

      let invitationId: string;
      
      // Use SAVEPOINT to handle unique constraint violations without aborting the transaction
      await conn.queryObject("SAVEPOINT before_insert");
      try {
        const inviteResult = await conn.queryObject<{ invitation_id: string }>(
          `INSERT INTO invitations (org_id, email, role, invited_by, status, metadata)
           VALUES ($1, $2, 'patient', $3, 'pending', $4::jsonb)
           RETURNING id as invitation_id`,
          [authResult.org_id, email, authResult.user_id, JSON.stringify(metadata)]
        );

        if (inviteResult.rows && inviteResult.rows.length > 0) {
          invitationId = inviteResult.rows[0].invitation_id;
          await conn.queryObject("RELEASE SAVEPOINT before_insert");
          return { invitation_id: invitationId };
        } else {
          throw new Error("Failed to create invitation");
        }
      } catch (error) {
        // Rollback to savepoint to recover from the error
        await conn.queryObject("ROLLBACK TO SAVEPOINT before_insert");
        
        // Handle unique constraint violation from partial index (race condition)
        if (
          error instanceof Error &&
          (error.message.includes("unique") ||
            error.message.includes("duplicate") ||
            error.message.includes("23505"))
        ) {
          // If metadata was provided, try to update existing invitation with new data
          // This allows clinicians to update patient info if inviting again
          if (Object.keys(metadata).length > 0) {
            try {
              const updateResult = await conn.queryObject<{ invitation_id: string }>(
                `UPDATE invitations
                 SET metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
                 WHERE org_id = $1 AND email = $2 AND role = 'patient' AND status = 'pending'
                 RETURNING id as invitation_id`,
                [authResult.org_id, email, JSON.stringify(metadata)]
              );
              if (updateResult.rows && updateResult.rows.length > 0) {
                invitationId = updateResult.rows[0].invitation_id;
                return { invitation_id: invitationId };
              }
            } catch {
              // If update fails, fall through to returning existing invitation
            }
          }

          const existingInvite = await conn.queryObject<{ invitation_id: string }>(
            "SELECT id as invitation_id FROM invitations WHERE org_id = $1 AND email = $2 AND role = 'patient' AND status = 'pending'",
            [authResult.org_id, email]
          );

          if (existingInvite.rows && existingInvite.rows.length > 0) {
            invitationId = existingInvite.rows[0].invitation_id;
            return { invitation_id: invitationId };
          }
        }
        throw error;
      }
    });

    const response: InviteResponse = {
      ok: true,
      invitation_id: result.invitation_id,
    };

    // Send magic link via Stytch Consumer API AFTER transaction commits
    // Use a separate connection for PKCE verifier storage
    // Wrap in try/catch to handle email failures without affecting the invitation record
    let emailFailed = false;
    try {
      await withConn(async (conn) => {
        await stytchConsumer.sendMagicLink(
          email,
          conn,
          "calico://auth/callback" // Native redirect URL for PKCE support
        );
      });
    } catch (emailError) {
      // Log the error but don't throw - the invitation record is already committed
      emailFailed = true;
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      const errorDetails = emailError instanceof Error ? {
        name: emailError.name,
        message: emailError.message,
        stack: emailError.stack,
      } : emailError;
      
      console.error(
        `Failed to send magic link email for invitation ${result.invitation_id}:`,
        errorMessage
      );
      console.error("Email error details:", errorDetails);
      
      // Store error details in response for debugging
      response.email_error = errorMessage;
    }

    // If email failed, return success but include a warning in the response
    // This allows the caller to retry sending the email if needed
    if (emailFailed) {
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
    console.error("Error details:", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

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
    } else if (error instanceof Error) {
      // Include error message for debugging
      message = `Internal server error: ${error.message}`;
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

Deno.serve(handler);
