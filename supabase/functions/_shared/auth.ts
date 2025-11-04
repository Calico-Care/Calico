import { withConn } from "@/db.ts";
import { stytchB2B } from "@/stytch.ts";

export interface StaffAuthResult {
  user_id: string;
  org_id: string;
  role: 'org_admin' | 'clinician';
  email: string;
  stytch_member_id: string;
}

/**
 * Authenticate a staff user via Stytch B2B session JWT
 * This helper synchronizes user state with the database and returns session context
 */
export async function authenticateStaff(sessionJwt: string): Promise<StaffAuthResult> {
  // Verify session with Stytch B2B API
  const authResponse = await stytchB2B.authenticateSession(sessionJwt);
  if (!authResponse.session || !authResponse.member || !authResponse.organization_id) {
    throw new Error("Invalid session");
  }

  const stytchUserId = authResponse.session.user_id;
  const stytchMemberId = authResponse.session.member_id;
  const stytchOrganizationId = authResponse.organization_id;
  const email = authResponse.member.email_address;

  // Map Stytch organization to our org_id
  const orgResult = await withConn(async (conn) => {
    return conn.queryObject<{ org_id: string }>(
      "SELECT id as org_id FROM organizations WHERE stytch_organization_id = $1",
      [stytchOrganizationId]
    );
  });

  if (orgResult.rows.length === 0) {
    throw new Error("Organization not found");
  }

  const orgId = orgResult.rows[0].org_id;

  // DB operations: synchronize state
  const result = await withConn(async (conn) => {
    await conn.queryObject("BEGIN");
    try {
      // Upsert user
      const userResult = await conn.queryObject<{ user_id: string }>(
        `INSERT INTO users (stytch_user_id, email)
         VALUES ($1, $2)
         ON CONFLICT (stytch_user_id)
         DO UPDATE SET email = EXCLUDED.email
         RETURNING id as user_id`,
        [stytchUserId, email]
      );

      const userId = userResult.rows[0].user_id;

      // Check if membership already exists
      const membershipCheck = await conn.queryObject<{ role: string }>(
        "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2",
        [orgId, userId]
      );

      let role: 'org_admin' | 'clinician';

      if (membershipCheck.rows.length === 0) {
        // No membership - look for pending invitation to infer role
        const inviteResult = await conn.queryObject<{ role: string; id: string }>(
          `SELECT role, id FROM invitations
           WHERE org_id = $1 AND email = $2 AND status = 'pending'
           AND role IN ('org_admin', 'clinician')`,
          [orgId, email]
        );

        if (inviteResult.rows.length === 0) {
          throw new Error("No pending staff invitation found");
        }

        role = inviteResult.rows[0].role as 'org_admin' | 'clinician';
        const invitationId = inviteResult.rows[0].id;

        // Create membership
        await conn.queryObject(
          `INSERT INTO memberships (org_id, user_id, role, status, stytch_member_id)
           VALUES ($1, $2, $3, 'active', $4)
           ON CONFLICT (org_id, user_id) DO NOTHING`,
          [orgId, userId, role, stytchMemberId]
        );

        // If clinician, create clinicians record
        if (role === 'clinician') {
          await conn.queryObject(
            `INSERT INTO clinicians (org_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (org_id, user_id) DO NOTHING`,
            [orgId, userId]
          );
        }

        // Mark invitation as accepted
        await conn.queryObject(
          "UPDATE invitations SET status = 'accepted' WHERE id = $1",
          [invitationId]
        );
      } else {
        // Membership exists - use existing role
        role = membershipCheck.rows[0].role as 'org_admin' | 'clinician';

        // Update stytch_member_id if needed
        await conn.queryObject(
          "UPDATE memberships SET stytch_member_id = $1 WHERE org_id = $2 AND user_id = $3",
          [stytchMemberId, orgId, userId]
        );
      }

      await conn.queryObject("COMMIT");
      return { user_id: userId, org_id: orgId, role, email, stytch_member_id: stytchMemberId };
    } catch (error) {
      try {
        await conn.queryObject("ROLLBACK");
      } catch (rollbackErr) {
        console.error("rollback failed", rollbackErr);
      }
      throw error;
    }
  });

  return result;
}
