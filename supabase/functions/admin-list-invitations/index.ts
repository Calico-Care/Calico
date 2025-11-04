import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "@/cors.ts";
import { withTenant } from "@/db.ts";
import { authenticateStaff, StaffAuthError, isStytchAuthError } from "@/auth.ts";

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by: string | null;
  created_at: string;
  stytch_invitation_id?: string | null;
}

interface ListResponse {
  invitations: Invitation[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
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
      return new Response(
        JSON.stringify({ error: "Only organization admins can list invitations" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse and validate pagination parameters
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    // Default values
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 200;

    // Parse and validate limit
    let limit = DEFAULT_LIMIT;
    if (limitParam !== null) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return new Response(
          JSON.stringify({ error: "Invalid limit: must be a positive integer" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      limit = Math.min(parsedLimit, MAX_LIMIT); // Clamp to max
    }

    // Parse and validate offset
    let offset = 0;
    if (offsetParam !== null) {
      const parsedOffset = parseInt(offsetParam, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return new Response(
          JSON.stringify({ error: "Invalid offset: must be a non-negative integer" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      offset = parsedOffset;
    }

    // List invitations using tenant context
    // HIPAA compliance: Only return staff invitations (org_admin, clinician)
    // Patient invitations contain PHI and should not be accessible to org admins
    const result = await withTenant(authResult.org_id, async (conn) => {
      // Query for limit + 1 to determine if there are more results
      const inviteResult = await conn.queryObject<Invitation>(
        `SELECT
          i.id,
          i.email,
          i.role,
          i.status,
          i.invited_by,
          i.created_at,
          i.stytch_invitation_id
         FROM invitations i
         WHERE i.org_id = $1 AND i.role IN ('org_admin', 'clinician')
         ORDER BY i.created_at DESC
         LIMIT $2 OFFSET $3`,
        [authResult.org_id, limit + 1, offset]
      );

      // Check if there are more results
      const hasMore = inviteResult.rows.length > limit;
      const invitations = hasMore ? inviteResult.rows.slice(0, limit) : inviteResult.rows;

      return { invitations, hasMore };
    }, authResult.user_id);

    const response: ListResponse = {
      invitations: result.invitations,
      pagination: {
        limit,
        offset,
        hasMore: result.hasMore,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("List invitations error:", error);

    let status = 500;
    let message = "Internal server error";

    if (error instanceof StaffAuthError) {
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
