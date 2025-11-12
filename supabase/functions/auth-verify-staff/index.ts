import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "@/cors.ts";
import { authenticateStaff, StaffAuthError, isStytchAuthError } from "@/auth.ts";

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Validate HTTP method
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

    // Authenticate staff user and synchronize DB state
    const result = await authenticateStaff(sessionJwt);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Staff auth verification error", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof StaffAuthError ? error.code : undefined,
    });

    let status = 500;
    let message = "Internal server error";

    if (error instanceof StaffAuthError) {
      switch (error.code) {
        case "NO_INVITATION":
          status = 404;
          message = error.message;
          break;
        case "INVALID_SESSION":
          status = 401;
          message = "Invalid session";
          break;
        case "ORGANIZATION_NOT_FOUND":
          status = 404;
          message = error.message;
          break;
        default:
          // Unknown error code, keep default 500
          message = error.message;
      }
    } else if (error instanceof Error) {
      // Catch Stytch API errors (e.g., invalid token, expired session)
      // These are thrown as generic Errors from stytchFetch
      if (isStytchAuthError(error)) {
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
