import { withConn } from "./db.ts";
import { stytchB2B, stytchConsumer } from "./stytch.ts";

export interface StaffAuthResult {
  user_id: string;
  org_id: string;
  role: 'org_admin' | 'clinician';
  email: string;
  stytch_member_id: string;
}

export type ConsumerAuthResult =
  | {
      kind: "single";
      user_id: string;
      org_id: string;
      org_ids?: never;
      role: "patient";
      email: string;
    }
  | {
      kind: "multi";
      user_id: string;
      org_ids: string[];
      org_id?: never;
      role: "patient";
      email: string;
    };

export class StaffAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "StaffAuthError";
  }
}

export class ConsumerAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "ConsumerAuthError";
  }
}

/**
 * Check if an error is a Stytch authentication error
 * Stytch API errors are thrown as generic Errors with message format:
 * "Stytch API error: {error_type} - {error_message} ({status_code})"
 * 
 * @param error - The error to check
 * @returns true if the error is a Stytch authentication error
 */
export function isStytchAuthError(error: Error): boolean {
  if (!error.message.includes("Stytch API error")) {
    return false;
  }
  
  const lowerMessage = error.message.toLowerCase();
  // Check for authentication-related errors
  return (
    lowerMessage.includes("invalid_session") ||
    lowerMessage.includes("unauthorized_credentials") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("(401)") ||
    lowerMessage.includes("(403)") ||
    lowerMessage.includes("session_not_found") ||
    lowerMessage.includes("intermediate_session_not_found")
  );
}

/**
 * Authenticate a staff user via Stytch B2B session JWT
 * This helper synchronizes user state with the database and returns session context
 */
export async function authenticateStaff(sessionJwt: string): Promise<StaffAuthResult> {
  // Verify session with Stytch B2B API
  let authResponse: Awaited<ReturnType<typeof stytchB2B.authenticateSession>>;
  try {
    authResponse = await stytchB2B.authenticateSession(sessionJwt);
  } catch (error) {
    // Catch Stytch API errors (invalid token, expired session, etc.)
    // and convert them to StaffAuthError for consistent error handling
    if (error instanceof Error) {
      // Use shared utility for consistent error detection
      if (isStytchAuthError(error)) {
        throw new StaffAuthError("Invalid session", "INVALID_SESSION");
      }
      // Also check for generic "Stytch API error" messages as fallback
      // This catches any Stytch API errors we haven't specifically handled
      if (error.message.includes("Stytch API error")) {
        throw new StaffAuthError("Invalid session", "INVALID_SESSION");
      }
    }
    // Re-throw other errors as-is
    throw error;
  }
  
  if (!authResponse.member_session || !authResponse.member) {
    throw new StaffAuthError("Invalid session", "INVALID_SESSION");
  }

  // Get organization_id from member_session (fallback to member if needed)
  const stytchOrganizationId = authResponse.member_session.organization_id || authResponse.member.organization_id || authResponse.organization_id;
  if (!stytchOrganizationId) {
    throw new StaffAuthError("Invalid session: missing organization_id", "INVALID_SESSION");
  }

  // For B2B members, use member_id as the user identifier
  // Some members may have an underlying user_id, but member_id is always present
  const stytchUserId = authResponse.member.user_id || authResponse.member.member_id;
  const stytchMemberId = authResponse.member_session.member_id;
  const email = authResponse.member.email_address;

  // Map Stytch organization to our org_id using SECURITY DEFINER function to bypass RLS
  const orgResult = await withConn(async (conn) => {
    return conn.queryObject<{ id: string }>(
      `SELECT id FROM admin.list_organizations() WHERE stytch_organization_id = $1`,
      [stytchOrganizationId]
    );
  });

  if (orgResult.rows.length === 0) {
    throw new StaffAuthError("Organization not found", "ORGANIZATION_NOT_FOUND");
  }

  const orgId = orgResult.rows[0].id;

  // DB operations: synchronize state
  const result = await withConn(async (conn) => {
    await conn.queryObject("BEGIN");
    await conn.queryObject("SET LOCAL search_path = public");
    // SET LOCAL requires literal value, not parameterized (orgId is safe as it comes from DB query)
    await conn.queryObject(`SET LOCAL app.org_id = '${orgId.replace(/'/g, "''")}'`);
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
          throw new StaffAuthError("No pending staff invitation found", "NO_INVITATION");
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

        // Ensure clinician row exists if role is clinician (handles edge cases)
        if (role === 'clinician') {
          await conn.queryObject(
            `INSERT INTO clinicians (org_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (org_id, user_id) DO NOTHING`,
            [orgId, userId]
          );
        }
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

/**
 * Authenticate a consumer user via Stytch Consumer session JWT
 * This helper synchronizes user state with the database and returns session context
 */
export async function authenticateConsumer(sessionJwt: string): Promise<ConsumerAuthResult> {
  // Verify session with Stytch Consumer API
  let authResponse: Awaited<ReturnType<typeof stytchConsumer.authenticateSession>>;
  try {
    authResponse = await stytchConsumer.authenticateSession(sessionJwt);
  } catch (error) {
    // Catch Stytch API errors (invalid token, expired session, etc.)
    // and convert them to ConsumerAuthError for consistent error handling
    if (error instanceof Error) {
      // Check if it's a Stytch authentication error using our utility
      if (isStytchAuthError(error)) {
        throw new ConsumerAuthError("Invalid session", "INVALID_SESSION");
      }
      // Also check for generic "Stytch API error" messages that might not match our patterns
      // This catches any Stytch API errors we haven't specifically handled
      if (error.message.includes("Stytch API error")) {
        // Check if it's likely an auth error based on status code
        const statusMatch = error.message.match(/\((\d+)\)/);
        if (statusMatch && (statusMatch[1] === "401" || statusMatch[1] === "403")) {
          throw new ConsumerAuthError("Invalid session", "INVALID_SESSION");
        }
        // If it's any Stytch API error but doesn't match patterns, still treat as auth error
        // This is defensive - any Stytch API error during authentication is likely auth-related
        throw new ConsumerAuthError("Invalid session", "INVALID_SESSION");
      }
    }
    // Re-throw other errors as-is (they'll be caught by endpoint handler)
    throw error;
  }
  
  if (!authResponse.session || !authResponse.user_id) {
    throw new ConsumerAuthError("Invalid session", "INVALID_SESSION");
  }

  const stytchUserId = authResponse.user_id;
  // Note: Consumer API doesn't return email in authenticate response
  // We'll get it from the users table or invitations later

  // DB operations: synchronize state
  const result = await withConn(async (conn) => {
    // First, check if user exists and get their email
    const userResult = await conn.queryObject<{ user_id: string; email: string }>(
      "SELECT id as user_id, email FROM users WHERE stytch_user_id = $1",
      [stytchUserId]
    );

    let userId: string;
    let email: string;

    if (userResult.rows.length === 0) {
      // Fetch email from Stytch since authenticate session response omits it
      const stytchUser = await stytchConsumer.getUser(stytchUserId);
      const primaryEmail =
        stytchUser.user.email_addresses.find((addr) => addr.primary)
          ?.email_address ?? stytchUser.user.email_addresses[0]?.email_address;

      if (!primaryEmail) {
        throw new ConsumerAuthError(
          "No email address found for Stytch user. User may not have completed email verification.",
          "NO_EMAIL"
        );
      }

      // User doesn't exist - look for pending invitation to get email
      const inviteResult = await conn.queryObject<{ email: string }>(
        "SELECT email FROM invitations WHERE email = $1 AND role = 'patient' AND status = 'pending'",
        [primaryEmail]
      );

      if (inviteResult.rows.length === 0) {
        throw new ConsumerAuthError("No pending patient invitation found for this user", "NO_INVITATION");
      }

      email = inviteResult.rows[0].email;

      // Create user
      const newUserResult = await conn.queryObject<{ user_id: string }>(
        "INSERT INTO users (stytch_user_id, email) VALUES ($1, $2) RETURNING id as user_id",
        [stytchUserId, email]
      );
      userId = newUserResult.rows[0].user_id;
    } else {
      userId = userResult.rows[0].user_id;
      email = userResult.rows[0].email;
    }

    // Check existing memberships
    const membershipResult = await conn.queryObject<{ org_id: string; role: string }>(
      "SELECT org_id, role FROM memberships WHERE user_id = $1 AND role = 'patient'",
      [userId]
    );

    if (membershipResult.rows.length === 0) {
      // No membership - look for pending invitation and extract metadata
      const inviteResult = await conn.queryObject<{
        org_id: string;
        id: string;
        metadata: Record<string, unknown> | null;
      }>(
        "SELECT org_id, id, metadata FROM invitations WHERE email = $1 AND role = 'patient' AND status = 'pending'",
        [email]
      );

      if (inviteResult.rows.length === 0) {
        throw new ConsumerAuthError("No pending patient invitation found", "NO_INVITATION");
      }

      const orgId = inviteResult.rows[0].org_id;
      const invitationId = inviteResult.rows[0].id;
      const metadata = inviteResult.rows[0].metadata || {};

      // Extract patient data from invitation metadata (provided by clinician during invitation)
      const legalName = typeof metadata.legal_name === "string" ? metadata.legal_name : null;
      const dob = typeof metadata.dob === "string" ? metadata.dob : null;

      // Begin transaction
      await conn.queryObject("BEGIN");
      try {
        // Create membership
        await conn.queryObject(
          "INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, 'patient', 'active')",
          [orgId, userId]
        );

        // Create patient record with data from invitation metadata (if provided)
        // legal_name and dob are now nullable, allowing creation without them
        // Patients can fill these in later during onboarding
        await conn.queryObject(
          `INSERT INTO patients (org_id, user_id, legal_name, dob)
           VALUES ($1, $2, $3, $4)`,
          [orgId, userId, legalName, dob]
        );

        // Mark invitation as accepted
        await conn.queryObject(
          "UPDATE invitations SET status = 'accepted' WHERE id = $1",
          [invitationId]
        );
        
        await conn.queryObject("COMMIT");
      } catch (error) {
        await conn.queryObject("ROLLBACK");
        throw error;
      }

      return {
        kind: "single" as const,
        user_id: userId,
        org_id: orgId,
        role: "patient" as const,
        email,
      };
    } else if (membershipResult.rows.length === 1) {
      // Single org membership
      const { org_id, role } = membershipResult.rows[0];
      
      // Ensure patient row exists (handles edge cases where membership exists but patient row is missing)
      await conn.queryObject(
        `INSERT INTO patients (org_id, user_id, legal_name, dob)
         VALUES ($1, $2, NULL, NULL)
         ON CONFLICT (org_id, user_id) DO NOTHING`,
        [org_id, userId]
      );
      
      return {
        kind: "single" as const,
        user_id: userId,
        org_id,
        role: role as "patient",
        email,
      };
    } else {
      // Multi-org patient - ensure patient row exists for each org
      const orgIds = membershipResult.rows.map((row) => row.org_id);
      
      // Create patient rows for any orgs that don't have one yet
      for (const orgId of orgIds) {
        await conn.queryObject(
          `INSERT INTO patients (org_id, user_id, legal_name, dob)
           VALUES ($1, $2, NULL, NULL)
           ON CONFLICT (org_id, user_id) DO NOTHING`,
          [orgId, userId]
        );
      }
      
      return {
        kind: "multi" as const,
        user_id: userId,
        org_ids: orgIds,
        role: "patient" as const,
        email,
      };
    }
  });

  return result;
}
