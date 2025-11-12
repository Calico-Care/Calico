import { corsHeaders } from "@/cors.ts";
import { withTenant } from "@/db.ts";
import { authenticateStaff, StaffAuthError } from "@/auth.ts";
import { isValidUuid } from "@/validators.ts";

interface AssignRequest {
  patient_id: string;
  clinician_id: string;
}

interface AssignResponse {
  ok: true;
  patient_id: string;
  clinician_id: string;
  message: string;
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
    const body: AssignRequest = await req.json();
    const { patient_id, clinician_id } = body;

    if (!patient_id || typeof patient_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid patient_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!clinician_id || typeof clinician_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid clinician_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate UUID format
    if (!isValidUuid(patient_id) || !isValidUuid(clinician_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid UUID format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Execute within tenant context
    await withTenant(authResult.org_id, async (conn) => {
      // Verify patient exists in this org
      const patientCheck = await conn.queryObject<{ id: string }>(
        "SELECT id FROM patients WHERE id = $1 AND org_id = $2",
        [patient_id, authResult.org_id]
      );

      if (patientCheck.rows.length === 0) {
        throw new Error("Patient not found in your organization");
      }

      // Verify clinician exists in this org
      const clinicianCheck = await conn.queryObject<{ id: string }>(
        "SELECT id FROM clinicians WHERE id = $1 AND org_id = $2",
        [clinician_id, authResult.org_id]
      );

      if (clinicianCheck.rows.length === 0) {
        throw new Error("Clinician not found in your organization");
      }

      // Create the patient-clinician relationship
      await conn.queryObject(
        `INSERT INTO patient_clinicians (patient_id, clinician_id, org_id, active, created_by)
         VALUES ($1, $2, $3, true, $4)
         ON CONFLICT (patient_id, clinician_id) DO UPDATE 
         SET active = true, created_by = EXCLUDED.created_by`,
        [patient_id, clinician_id, authResult.org_id, authResult.user_id]
      );
    });

    const response: AssignResponse = {
      ok: true,
      patient_id,
      clinician_id,
      message: "Clinician successfully assigned to patient",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error assigning clinician to patient:", error);

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
        default:
          status = 500;
          message = error.message;
      }
    } else if (error instanceof Error) {
      message = error.message;
      // Check for common database errors
      if (message.includes("not found")) {
        status = 404;
      }
    }

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
