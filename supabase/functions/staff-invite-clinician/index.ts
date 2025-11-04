import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "@/cors.ts";
import { withConn, withTenant } from "@/db.ts";
import { authenticateStaff, StaffAuthError, isStytchAuthError } from "@/auth.ts";
import { stytchB2B } from "@/stytch.ts";

interface InviteRequest {
  email: string;
  name?: string;
}

interface InviteResponse {
  ok: true;
  invitation_id: string;
  stytch_invitation_id: string;
}

class StaffInviteError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "StaffInviteError";
  }
}

serve(async (req: Request): Promise<Response> => {
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

    // Require org_admin role
    if (authResult.role !== 'org_admin') {
      throw new StaffInviteError("Only organization admins can invite clinicians", 403);
    }

    // Parse request body
    const body: InviteRequest = await req.json();
    const { email, name } = body;

    if (!email || typeof email !== "string") {
      throw new StaffInviteError("Invalid email", 400);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new StaffInviteError("Invalid email format", 400);
    }

    // Validate optional name field
    let validatedName: string | undefined = undefined;
    if (name !== undefined && name !== null) {
      if (typeof name !== "string") {
        throw new StaffInviteError("Invalid name: must be a string", 400);
      }
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        throw new StaffInviteError("Invalid name: cannot be empty", 400);
      }
      if (trimmedName.length > 100) {
        throw new StaffInviteError("Invalid name: must be 100 characters or less", 400);
      }
      validatedName = trimmedName;
    }

    // Get Stytch organization ID and invite clinician
    // Operation order: DB insert FIRST, then Stytch API call
    // This ensures database consistency - if Stytch fails, transaction rolls back cleanly
    // If DB insert fails due to race condition, return existing invitation without calling Stytch
    const result = await withTenant(authResult.org_id, async (conn) => {
      // Get Stytch organization ID
      const orgResult = await conn.queryObject<{ stytch_organization_id: string }>(
        "SELECT stytch_organization_id FROM organizations WHERE id = $1",
        [authResult.org_id]
      );

      if (orgResult.rows.length === 0) {
        throw new StaffInviteError("Organization not found", 404);
      }

      const stytchOrgId = orgResult.rows[0].stytch_organization_id;

      // Try to insert invitation record first (handles race conditions)
      let inviteResult: { invitation_id: string; stytch_invitation_id?: string } | null = null;
      
      try {
        const insertResult = await conn.queryObject<{ invitation_id: string }>(
          `INSERT INTO invitations (org_id, email, role, invited_by, status, stytch_invitation_id)
           VALUES ($1, $2, 'clinician', $3, 'pending', NULL)
           RETURNING id as invitation_id`,
          [authResult.org_id, email, authResult.user_id]
        );

        if (insertResult.rows && insertResult.rows.length > 0) {
          inviteResult = { invitation_id: insertResult.rows[0].invitation_id };
        }
      } catch (error) {
        // Handle unique constraint violation from partial index (race condition)
        if (
          error instanceof Error &&
          (error.message.includes("unique") ||
            error.message.includes("duplicate") ||
            error.message.includes("23505"))
        ) {
          // Another request already created the invitation - check if Stytch call was completed
          const existingInvite = await conn.queryObject<{ id: string; stytch_invitation_id: string | null }>(
            "SELECT id, stytch_invitation_id FROM invitations WHERE org_id = $1 AND email = $2 AND role = 'clinician' AND status = 'pending'",
            [authResult.org_id, email]
          );

          if (existingInvite.rows && existingInvite.rows.length > 0) {
            const existingId = existingInvite.rows[0].id;
            const existingStytchId = existingInvite.rows[0].stytch_invitation_id;

            // If Stytch invitation already exists, short-circuit and return immediately
            if (existingStytchId !== null) {
              return {
                invitation_id: existingId,
                stytch_invitation_id: existingStytchId,
              };
            }

            // If Stytch invitation is null, capture the ID and continue to call Stytch
            inviteResult = { invitation_id: existingId };
          } else {
            // Should not happen, but re-throw if no existing invitation found
            throw error;
          }
        } else {
          // Re-throw other errors
          throw error;
        }
      }

      // If we get here, we have an invitation record (either newly inserted or existing with null stytch_invitation_id)
      // Guard against missing invitation_id (should never happen, but ensure type safety)
      if (!inviteResult || !inviteResult.invitation_id) {
        throw new StaffInviteError("Internal error: invitation record missing after insert", 500);
      }

      // Now call Stytch API - if this fails, transaction will rollback
      const stytchResponse = await stytchB2B.inviteMember(
        stytchOrgId,
        email,
        validatedName,
        ['stytch_member'] // Default permissions for clinicians
      );

      // Update invitation record with Stytch member ID
      await conn.queryObject(
        `UPDATE invitations 
         SET stytch_invitation_id = $1 
         WHERE id = $2`,
        [stytchResponse.member_id, inviteResult.invitation_id]
      );

      return {
        invitation_id: inviteResult.invitation_id,
        stytch_invitation_id: stytchResponse.member_id,
      };
    }, authResult.user_id);

    const response: InviteResponse = {
      ok: true,
      invitation_id: result.invitation_id,
      stytch_invitation_id: result.stytch_invitation_id,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Clinician invite error:", error);

    let status = 500;
    let message = "Internal server error";

    if (error instanceof StaffInviteError) {
      status = error.statusCode;
      message = error.message;
    } else if (error instanceof StaffAuthError) {
      switch (error.code) {
        case "INVALID_SESSION":
          status = 401;
          message = "Invalid session";
          break;
        case "NO_INVITATION":
          status = 404;
          message = error.message;
          break;
        case "ORGANIZATION_NOT_FOUND":
          status = 404;
          message = error.message;
          break;
        default:
          message = error.message;
      }
    } else if (error instanceof Error) {
      if (isStytchAuthError(error)) {
        status = 401;
        message = "Invalid session";
      }
      // Other errors fall through with default 500 status
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
