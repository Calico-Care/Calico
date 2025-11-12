import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "@/cors.ts";
import {
  authenticateConsumer,
  ConsumerAuthError,
  ConsumerAuthResult,
  isStytchAuthError,
} from "@/auth.ts";
import { createVAPIAssistantForPatient } from "@/vapi.ts";

type AuthResponse = ConsumerAuthResult;

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

    // Authenticate consumer user using shared helper
    const result = await authenticateConsumer(sessionJwt);

    // Create VAPI assistant if needed (after auth succeeds)
    // This happens asynchronously and doesn't block the auth response
    if (result.kind === "single") {
      // Single org patient - create assistant if missing
      createVAPIAssistantForPatient(
        result.org_id,
        result.user_id,
        result.email
      ).catch((err) => {
        // Log error but don't fail auth
        console.error(
          `Failed to create VAPI assistant for patient ${result.user_id} in org ${result.org_id}:`,
          err
        );
      });
    } else if (result.kind === "multi") {
      // Multi-org patient - create assistant for each org if missing
      for (const orgId of result.org_ids) {
        createVAPIAssistantForPatient(
          orgId,
          result.user_id,
          result.email
        ).catch((err) => {
          // Log error but don't fail auth
          console.error(
            `Failed to create VAPI assistant for patient ${result.user_id} in org ${orgId}:`,
            err
          );
        });
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auth verification error", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof ConsumerAuthError ? error.code : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    let status = 500;
    let message = "Internal server error";

    if (error instanceof ConsumerAuthError) {
      switch (error.code) {
        case "INVALID_SESSION":
          status = 401;
          message = "Invalid session";
          break;
        case "NO_INVITATION":
          status = 404;
          message = error.message;
          break;
        case "NO_EMAIL":
          status = 400;
          message = error.message;
          break;
        default:
          status = 500;
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

    const details =
      error instanceof ConsumerAuthError
        ? error.message
        : error instanceof Error && isStytchAuthError(error)
          ? "Invalid session"
          : "An unexpected error occurred";

    return new Response(
      JSON.stringify({
        error: message,
        details,
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
