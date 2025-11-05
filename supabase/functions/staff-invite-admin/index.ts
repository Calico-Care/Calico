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

    // Create pending member via Stytch B2B API
    // Assign 'stytch_admin' role so org admin can invite clinicians
    let stytch_member_id: string | undefined;
    let stytchResponse: { member_id: string } | undefined;
    
    try {
      stytchResponse = await stytchB2B.inviteMember(
        stytch_organization_id,
        email,
        name,
        ["stytch_admin"]
      );
      if (!stytchResponse?.member_id) {
        throw new Error("Missing member_id from Stytch invite response");
      }
      stytch_member_id = stytchResponse.member_id;
    } catch (error) {
      // Handle duplicate member error - member already exists
      if (
        error instanceof Error &&
        (error.message.includes("duplicate_member_email") ||
          error.message.includes("already exists"))
      ) {
        // Try to find member_id from our database first
        // Check invitations table for existing pending invitation
        const inviteResult = await withTenant(
          org_id,
          (c: PoolClient) =>
            c.queryObject<{ stytch_invitation_id: string | null }>(
              `SELECT stytch_invitation_id FROM invitations 
               WHERE org_id = $1 AND email = $2 AND role = 'org_admin' AND status = 'pending'
               LIMIT 1`,
              [org_id, email]
            )
        );

        if (inviteResult.rows.length > 0 && inviteResult.rows[0].stytch_invitation_id) {
          stytch_member_id = inviteResult.rows[0].stytch_invitation_id;
        } else {
          // Check memberships table for existing member
          const dbMemberResult = await withTenant(
            org_id,
            (c: PoolClient) =>
              c.queryObject<{ stytch_member_id: string }>(
                `SELECT stytch_member_id FROM memberships 
                 WHERE org_id = $1 AND user_id IN (
                   SELECT id FROM users WHERE email = $2
                 )
                 LIMIT 1`,
                [org_id, email]
              )
          );

          if (dbMemberResult.rows.length > 0 && dbMemberResult.rows[0].stytch_member_id) {
            stytch_member_id = dbMemberResult.rows[0].stytch_member_id;
          } else {
            // If not in database, try searching Stytch (with pagination)
            // Note: This may fail if searchMembers requires RBAC auth
            let foundMember = false;
            let cursor: string | null | undefined = undefined;
            
            for (let attempt = 0; attempt < 10 && !foundMember; attempt++) {
              try {
                const searchResult = await stytchB2B.searchMembers(
                  [stytch_organization_id],
                  100,
                  undefined,
                  cursor
                );
                
                const existingMember = searchResult.members.find(
                  (m) => m.email_address?.toLowerCase() === email.toLowerCase()
                );
                
                if (existingMember && existingMember.member_id) {
                  stytch_member_id = existingMember.member_id;
                  foundMember = true;
                  break;
                }
                
                cursor = searchResult.results_metadata?.next_cursor;
                if (!cursor) break;
              } catch (searchError) {
                // If searchMembers fails (e.g., requires RBAC), skip Stytch search
                console.warn(
                  `Failed to search Stytch members: ${searchError instanceof Error ? searchError.message : String(searchError)}`
                );
                break;
              }
            }
            
            if (!foundMember || !stytch_member_id) {
              throw new Error(
                `Member with email ${email} exists in Stytch but could not be found. Please invite them manually via Stytch dashboard, or use an existing invitation.`
              );
            }
          }
        }
        
        // Try to send invite email for existing member using sendInviteEmail
        // Works with API secret auth (RBAC is only enforced when member session is passed)
        // NOTE: Stytch requires billing verification to send emails to external domains
        if (stytch_member_id) {
          try {
            console.log(`Attempting to send invite email to existing member: ${stytch_member_id} (email: ${email})`);
            await stytchB2B.sendInviteEmail(
              stytch_organization_id,
              email,
              name,
              ["stytch_admin"]
            );
            console.log(`Successfully sent invite email to existing member: ${stytch_member_id}`);
          } catch (emailError) {
            // If sendInviteEmail fails (e.g., requires RBAC auth), log but continue
            console.error(
              `Failed to send invite email for existing member: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
              emailError instanceof Error ? emailError.stack : undefined
            );
          }
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }

    if (!stytch_member_id) {
      throw new Error("Missing member_id from Stytch invite response");
    }

    // Send the actual invitation email (if member was just created)
    // For existing members, we already tried above
    // Works with API secret auth (RBAC is only enforced when member session is passed)
    // NOTE: Stytch requires billing verification to send emails to external domains
    if (stytchResponse) {
      try {
        console.log(`Attempting to send invite email to new member: ${stytch_member_id} (email: ${email})`);
        await stytchB2B.sendInviteEmail(
          stytch_organization_id,
          email,
          name,
          ["stytch_admin"]
        );
        console.log(`Successfully sent invite email to new member: ${stytch_member_id}`);
      } catch (emailError) {
        // If sendInviteEmail fails (e.g., requires RBAC auth), log but continue
        // The member was created, so we can still return success
        console.error(
          `Failed to send invite email: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
          emailError instanceof Error ? emailError.stack : undefined
        );
      }
    }

    // Insert or update invitation record using withTenant to satisfy RLS
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
          ON CONFLICT (org_id, email, role) WHERE status = 'pending'
          DO UPDATE SET stytch_invitation_id = EXCLUDED.stytch_invitation_id
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
