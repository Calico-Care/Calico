import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "@/cors.ts";
import { withConn } from "@/db.ts";
import { stytchB2B, type StytchB2BMember } from "@/stytch.ts";
import { authenticateStaff, StaffAuthError, isStytchAuthError } from "@/auth.ts";

const CALICO_OPS_TOKEN = Deno.env.get("CALICO_OPS_TOKEN");

if (!CALICO_OPS_TOKEN) throw new Error("Missing CALICO_OPS_TOKEN");

interface SyncRequest {
  session_jwt: string; // Stytch B2B session JWT from authenticated org_admin
  organization_id?: string; // Optional: sync only this organization (must match session's org)
}

interface SyncResponse {
  ok: boolean;
  synced_organizations: number;
  synced_members: number;
  errors?: string[];
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
    // Check authorization with ops token
    const auth = req.headers.get("authorization") || "";
    const token = (/^Bearer\s+(.+)$/i.exec(auth)?.[1] || "").trim();
    if (!token || token !== CALICO_OPS_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body to get session JWT
    let body: SyncRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.session_jwt || typeof body.session_jwt !== "string") {
      return new Response(
        JSON.stringify({
          error: "session_jwt is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Authenticate the session and verify it's an org_admin
    let authResult;
    try {
      authResult = await authenticateStaff(body.session_jwt);
    } catch (error) {
      if (error instanceof StaffAuthError) {
        return new Response(
          JSON.stringify({
            error: error.message,
          }),
          {
            status: error.code === "INVALID_SESSION" ? 401 : 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else if (error instanceof Error && isStytchAuthError(error)) {
        return new Response(
          JSON.stringify({
            error: "Invalid session",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    // Verify user is org_admin
    if (authResult.role !== "org_admin") {
      return new Response(
        JSON.stringify({
          error: "Only organization admins can sync members",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let syncedOrganizations = 0;
    let syncedMembers = 0;
    const errors: string[] = [];

    // Get the organization to sync
    let targetOrgId: string | null = null;
    if (body.organization_id) {
      targetOrgId = body.organization_id;
      // Verify the requested org matches the session's org
      if (targetOrgId !== authResult.org_id) {
        return new Response(
          JSON.stringify({
            error: "Cannot sync organization: session does not belong to requested organization",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      // Default to syncing the organization from the session
      targetOrgId = authResult.org_id;
    }

    // Get organization details from local DB
    const localOrgResult = await withConn(async (conn) => {
      const result = await conn.queryObject<{
        id: string;
        stytch_organization_id: string;
        name: string;
      }>(
        `SELECT id, name, stytch_organization_id 
         FROM admin.list_organizations() 
         WHERE id = $1`,
        [targetOrgId]
      );
      return result.rows[0];
    });

    if (!localOrgResult) {
      return new Response(
        JSON.stringify({
          error: "Organization not found in local database",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!localOrgResult.stytch_organization_id) {
      return new Response(
        JSON.stringify({
          error: "Organization does not have a Stytch organization ID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      // Step 1: Sync organization name from Stytch (if different)
      try {
        const stytchOrgResponse = await stytchB2B.getOrganization(
          localOrgResult.stytch_organization_id,
          body.session_jwt
        );
        
        const stytchOrgName = stytchOrgResponse.organization?.organization_name || 
                              stytchOrgResponse.organization_id;
        
        if (stytchOrgName && stytchOrgName !== localOrgResult.name) {
          // Update organization name in local database
          await withConn(async (conn) => {
            await conn.queryObject(
              `SELECT admin.update_organization($1::uuid, $2::text)`,
              [localOrgResult.id, stytchOrgName]
            );
          });
          console.log(`Updated organization name from "${localOrgResult.name}" to "${stytchOrgName}"`);
        }
      } catch (orgSyncError) {
        // Log but don't fail the entire sync if org name sync fails
        console.error(`Failed to sync organization name: ${orgSyncError instanceof Error ? orgSyncError.message : String(orgSyncError)}`);
      }

      // Step 2: Fetch members from Stytch using session JWT for RBAC authentication (with pagination)
      const stytchMembers: StytchB2BMember[] = [];
      
      let nextCursor: string | null | undefined = undefined;
      
      do {
        try {
          const membersResponse = await stytchB2B.searchMembers(
            [localOrgResult.stytch_organization_id],
            100,
            body.session_jwt,
            nextCursor
          );
          
          // Accumulate members from this page
          if (membersResponse.members && Array.isArray(membersResponse.members)) {
            stytchMembers.push(...membersResponse.members);
          }
          
          // Check for next page
          nextCursor = membersResponse.results_metadata?.next_cursor || null;
        } catch (pageError) {
          // Log pagination error but continue with members fetched so far
          console.error(`Failed to fetch member page (cursor: ${nextCursor}): ${pageError instanceof Error ? pageError.message : String(pageError)}`);
          break; // Stop pagination on error, but proceed with members already fetched
        }
      } while (nextCursor);

      // Step 3: Sync members to local database
      // First, upsert all users (users table has no RLS)
      const userIds = new Map<string, string>(); // stytch_user_id -> local user_id
      await withConn(async (conn) => {
        for (const member of stytchMembers) {
          if (!member.user_id) continue; // Skip pending members

          // Upsert user record
          await conn.queryObject(
            `INSERT INTO users (stytch_user_id, email)
             VALUES ($1, $2)
             ON CONFLICT (stytch_user_id)
             DO UPDATE SET email = EXCLUDED.email`,
            [member.user_id, member.email_address]
          );

          // Get user_id from users table
          const userResult = await conn.queryObject<{ id: string }>(
            "SELECT id FROM users WHERE stytch_user_id = $1",
            [member.user_id]
          );

          if (userResult.rows.length > 0) {
            userIds.set(member.user_id, userResult.rows[0].id);
          }
        }
      });

          // Now sync memberships, clinicians, and invitations within tenant context
          // Use local counter to avoid inflating shared counter on rollback
          let localSyncedMembers = 0;
          await withConn(async (conn) => {
            await conn.queryObject("BEGIN");
            await conn.queryObject("SET LOCAL search_path = public");
            // SET LOCAL requires literal value, not parameterized (orgId is safe as it comes from DB query)
            await conn.queryObject(`SET LOCAL app.org_id = '${localOrgResult.id.replace(/'/g, "''")}'`);
            
            try {
          for (const member of stytchMembers) {
            // Skip if member doesn't have user_id (pending members)
            if (!member.user_id) {
              continue;
            }

            const userId = userIds.get(member.user_id);
            if (!userId) {
              console.warn(`Skipping member ${member.member_id}: user_id not found`);
              continue;
            }

            // Check existing membership
            const membershipCheck = await conn.queryObject<{
              id: string;
              role: string;
              status: string;
            }>(
              "SELECT id, role, status FROM memberships WHERE org_id = $1 AND user_id = $2",
              [localOrgResult.id, userId]
            );

            if (membershipCheck.rows.length > 0) {
              // Update existing membership with stytch_member_id
              await conn.queryObject(
                `UPDATE memberships
                 SET stytch_member_id = $1,
                     status = CASE
                       WHEN $2 = 'active' THEN 'active'::membership_status
                       WHEN $2 = 'pending' THEN 'active'::membership_status
                       ELSE 'inactive'::membership_status
                     END
                 WHERE org_id = $3 AND user_id = $4`,
                [
                  member.member_id,
                  member.status || "active",
                  localOrgResult.id,
                  userId,
                ]
              );
            } else {
              // Determine role from invitation or default to clinician
              // Check for pending invitation to infer role
              const inviteResult = await conn.queryObject<{ role: string }>(
                `SELECT role FROM invitations
                 WHERE org_id = $1 AND email = $2 AND status = 'pending'
                 LIMIT 1`,
                [localOrgResult.id, member.email_address]
              );

              let role: "org_admin" | "clinician" = "clinician";
              if (
                inviteResult.rows.length > 0 &&
                (inviteResult.rows[0].role === "org_admin" ||
                  inviteResult.rows[0].role === "clinician")
              ) {
                role = inviteResult.rows[0].role as "org_admin" | "clinician";
              }

              // Insert new membership
              await conn.queryObject(
                `INSERT INTO memberships (org_id, user_id, role, status, stytch_member_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                  localOrgResult.id,
                  userId,
                  role,
                  member.status === "inactive" ? "inactive" : "active",
                  member.member_id,
                ]
              );

              // If role is clinician, ensure clinicians row exists
              if (role === "clinician") {
                await conn.queryObject(
                  `INSERT INTO clinicians (org_id, user_id)
                   VALUES ($1, $2)
                   ON CONFLICT (org_id, user_id) DO NOTHING`,
                  [localOrgResult.id, userId]
                );
              }
            }

            localSyncedMembers++;
          }
          
          await conn.queryObject("COMMIT");
          
          // Increment success counters only after successful transaction commit
          syncedMembers += localSyncedMembers;
          syncedOrganizations += 1;
        } catch (e) {
          await conn.queryObject("ROLLBACK");
          throw e;
        }
      });
    } catch (error) {
      const errorMsg = `Failed to sync org ${localOrgResult.stytch_organization_id}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(errorMsg, error);
    }

    const response: SyncResponse = {
      ok: errors.length === 0,
      synced_organizations: syncedOrganizations,
      synced_members: syncedMembers,
      ...(errors.length > 0 && { errors }),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stytch sync error:", error);

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
