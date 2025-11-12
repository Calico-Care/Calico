import { withConn, setOrgContext, withTransaction } from "./db.ts";
import { stytchB2B, stytchConsumer } from "./stytch.ts";
import { isValidUuid } from "./validators.ts";

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
  
  // Validate orgId is a valid UUID
  if (!orgId || !isValidUuid(orgId)) {
    throw new StaffAuthError("Invalid organization ID returned from database", "INVALID_ORG_ID");
  }

  // DB operations: synchronize state
  const result = await withConn(async (conn) => {
    await conn.queryObject("SET LOCAL search_path = public");
    
    return await withTransaction(conn, async (conn) => {
      await setOrgContext(conn, orgId);
      
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
      
      // Validate userId is a valid UUID
      if (!userId || !isValidUuid(userId)) {
        throw new StaffAuthError("Invalid user ID returned from database", "INVALID_USER_ID");
      }

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
             ON CONFLICT (user_id) DO NOTHING`,
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
             ON CONFLICT (user_id) DO NOTHING`,
            [orgId, userId]
          );
        }
      }

      return { user_id: userId, org_id: orgId, role, email, stytch_member_id: stytchMemberId };
    });
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
    console.log("Calling stytchConsumer.authenticateSession with JWT:", sessionJwt.substring(0, 50) + "...");
    authResponse = await stytchConsumer.authenticateSession(sessionJwt);
    console.log("Stytch authentication successful:", {
      user_id: authResponse.user_id,
      has_session: !!authResponse.session,
    });
  } catch (error) {
    console.error("Stytch authentication failed:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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
  
  // Consumer API can return user_id either at top level or inside session object
  const stytchUserId = authResponse.user_id || authResponse.session?.user_id;
  
  if (!authResponse.session || !stytchUserId) {
    console.error("Invalid auth response structure:", {
      has_session: !!authResponse.session,
      has_top_level_user_id: !!authResponse.user_id,
      has_session_user_id: !!authResponse.session?.user_id,
      session_keys: authResponse.session ? Object.keys(authResponse.session) : [],
    });
    throw new ConsumerAuthError("Invalid session", "INVALID_SESSION");
  }
  
  // Validate stytchUserId is not empty string
  if (typeof stytchUserId !== 'string' || stytchUserId.trim() === '') {
    throw new ConsumerAuthError("Invalid Stytch user ID", "INVALID_SESSION");
  }
  // Note: Consumer API doesn't return email in authenticate response
  // We'll get it from the users table or invitations later

  // DB operations: synchronize state
  const result = await withConn(async (conn) => {
    // First, check if user exists and get their email
    const userResult = await conn.queryObject<{ user_id: string; email: string }>(
      "SELECT id as user_id, email FROM users WHERE stytch_user_id = $1",
      [stytchUserId.trim()]
    );

    let userId: string;
    let email: string;

    if (userResult.rows.length === 0) {
      // Fetch email from Stytch since authenticate session response omits it
      const stytchUser = await stytchConsumer.getUser(stytchUserId);
      console.log("Stytch user response:", {
        has_email_addresses: !!stytchUser.email_addresses,
        has_emails: !!stytchUser.emails,
        email_addresses_length: stytchUser.email_addresses?.length || 0,
        emails_length: stytchUser.emails?.length || 0,
        email_addresses: stytchUser.email_addresses,
        emails: stytchUser.emails,
      });
      
      // Stytch Consumer API returns emails in either email_addresses or emails array
      // And the email field can be either 'email' or 'email_address'
      const emailList = stytchUser.email_addresses || stytchUser.emails || [];
      console.log("Email list extracted:", emailList);
      
      const getEmailFromAddress = (addr: { email?: string; email_address?: string }) => {
        const email = addr.email || addr.email_address || '';
        console.log("Extracting email from address:", { addr, extracted: email });
        return email;
      };
      
      const primaryEmail =
        getEmailFromAddress(emailList.find((addr) => addr.primary) || emailList[0] || {});
      
      console.log("Primary email extracted:", primaryEmail);
      console.log("Email list details:", {
        listLength: emailList.length,
        firstItem: emailList[0],
        primaryItem: emailList.find((addr) => addr.primary),
        allItems: emailList,
      });

      if (!primaryEmail) {
        console.error("CRITICAL: primaryEmail is empty or undefined!", {
          emailList,
          emailListLength: emailList.length,
          stytchUserKeys: Object.keys(stytchUser),
        });
        throw new ConsumerAuthError(
          "No email address found for Stytch user. User may not have completed email verification.",
          "NO_EMAIL"
        );
      }

      // User doesn't exist - look for pending invitation to get email
      // Normalize email to lowercase for case-insensitive matching
      const normalizedEmail = primaryEmail.toLowerCase().trim();
      console.log("Looking for invitation with email:", normalizedEmail);
      console.log("Email details:", {
        original: primaryEmail,
        normalized: normalizedEmail,
        length: normalizedEmail.length,
        charCodes: normalizedEmail.split('').map(c => c.charCodeAt(0)),
      });
      
      // Use SECURITY DEFINER function to bypass RLS (we don't know org_id yet)
      const inviteResult = await conn.queryObject<{
        email: string;
        org_id: string;
        id: string;
        metadata: Record<string, unknown> | null;
        invited_by: string | null;
      }>(
        "SELECT * FROM lookup_invitation_by_email($1)",
        [normalizedEmail]
      );

      console.log("Invitation lookup result:", {
        found: inviteResult.rows.length > 0,
        count: inviteResult.rows.length,
        email: normalizedEmail,
        rows: inviteResult.rows,
      });

      // Also check what invitations exist for debugging
      const allInvitesCheck = await conn.queryObject<{ email: string; status: string; role: string }>(
        "SELECT email, status, role FROM invitations WHERE LOWER(email) = LOWER($1) AND role = 'patient'",
        [normalizedEmail]
      );
      console.log("All invitations for this email (any status):", allInvitesCheck.rows);

      if (inviteResult.rows.length === 0) {
        throw new ConsumerAuthError("No pending patient invitation found for this user", "NO_INVITATION");
      }

      email = inviteResult.rows[0].email;
      const orgIdFromInvite = inviteResult.rows[0].org_id;
      const invitationIdFromInvite = inviteResult.rows[0].id;
      const metadataFromInvite = inviteResult.rows[0].metadata || {};
      const rawInvitedBy = inviteResult.rows[0].invited_by;
      
      // Log the raw value for debugging
      console.log("Raw invited_by value:", {
        value: rawInvitedBy,
        type: typeof rawInvitedBy,
        isNull: rawInvitedBy === null,
        isUndefined: rawInvitedBy === undefined,
        stringValue: String(rawInvitedBy),
        length: rawInvitedBy ? String(rawInvitedBy).length : 0,
      });
      
      // Defensively validate: ensure it's a valid UUID string, not empty string or invalid value
      // Handle null, undefined, empty string, and invalid UUIDs
      let invitedByFromInvite: string | null = null;
      if (rawInvitedBy != null && typeof rawInvitedBy === 'string') {
        const trimmed = rawInvitedBy.trim();
        if (trimmed !== '' && isValidUuid(trimmed)) {
          invitedByFromInvite = trimmed;
        } else {
          console.warn("Invitation has invalid invited_by value", {
            invitationId: invitationIdFromInvite,
            rawInvitedBy,
            trimmed,
            type: typeof rawInvitedBy,
          });
        }
      }
      
      // Additional validation: ensure orgIdFromInvite is valid
      if (!orgIdFromInvite || typeof orgIdFromInvite !== 'string' || orgIdFromInvite.trim() === '' || !isValidUuid(orgIdFromInvite)) {
        throw new ConsumerAuthError("Invalid organization ID in invitation", "INVALID_INVITATION");
      }
      
      // Ensure orgIdFromInvite is trimmed before use
      const validatedOrgId = orgIdFromInvite.trim();

      // Create user
      const newUserResult = await conn.queryObject<{ user_id: string }>(
        "INSERT INTO users (stytch_user_id, email) VALUES ($1, $2) RETURNING id as user_id",
        [stytchUserId.trim(), email]
      );
      if (!newUserResult.rows[0] || !newUserResult.rows[0].user_id) {
        throw new ConsumerAuthError("Failed to create user", "USER_CREATION_FAILED");
      }
      userId = newUserResult.rows[0].user_id;
      
      // Validate userId is a valid UUID
      if (!isValidUuid(userId)) {
        throw new ConsumerAuthError("Invalid user ID returned from database", "INVALID_USER_ID");
      }

      // For new users, directly create the patient membership and relationship
      // Extract patient data from invitation metadata
      const legalName = typeof metadataFromInvite.legal_name === "string" ? metadataFromInvite.legal_name : null;
      const dob = typeof metadataFromInvite.dob === "string" ? metadataFromInvite.dob : null;

      console.log("Creating patient membership for new user:", { orgIdFromInvite, userId, invitationIdFromInvite });

      // Use withTransaction helper and set RLS context
      try {
        console.log("Starting transaction for new user");
        await withTransaction(conn, async (conn) => {
          console.log("Inside transaction, setting context");
          await conn.queryObject("SET LOCAL search_path = public");
          await setOrgContext(conn, validatedOrgId);
          
          console.log("Creating membership");
          await conn.queryObject(
            `INSERT INTO memberships (org_id, user_id, role, status)
             VALUES ($1, $2, 'patient', 'active')`,
            [validatedOrgId, userId]
          );

          console.log("Creating patient record");
          const patientResult = await conn.queryObject<{ id: string }>(
            `INSERT INTO patients (org_id, user_id, legal_name, dob)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [validatedOrgId, userId, legalName, dob]
          );
          if (!patientResult.rows[0] || !patientResult.rows[0].id) {
            throw new Error("Failed to create patient record");
          }
          const patientId = patientResult.rows[0].id;
          
          // Validate patientId is a valid UUID
          if (!isValidUuid(patientId)) {
            throw new Error("Invalid patient ID returned from database");
          }

          console.log("Creating patient-clinician relationship");
          // Create patient-clinician relationship if the invitation was sent by a clinician
          // Double-check: ensure invitedByFromInvite is not null and not empty string
          if (invitedByFromInvite && invitedByFromInvite.trim() !== '' && isValidUuid(invitedByFromInvite)) {
            const clinicianResult = await conn.queryObject<{ id: string }>(
              "SELECT id FROM clinicians WHERE org_id = $1 AND user_id = $2",
              [validatedOrgId, invitedByFromInvite]
            );

            if (clinicianResult.rows.length > 0) {
              const clinicianId = clinicianResult.rows[0].id;
              
              // Validate clinicianId is a valid UUID
              if (!clinicianId || !isValidUuid(clinicianId)) {
                console.warn("Invalid clinician ID returned from database", { clinicianId });
                throw new Error("Invalid clinician ID returned from database");
              }
              
              console.log("Linking new patient to clinician:", { patientId, clinicianId });
              
              await conn.queryObject(
                `INSERT INTO patient_clinicians (patient_id, clinician_id, org_id, active, created_by)
                 VALUES ($1, $2, $3, true, $4)`,
                [patientId, clinicianId, validatedOrgId, invitedByFromInvite]
              );
            } else {
              console.log("Inviter is not a clinician, skipping patient-clinician relationship");
            }
          }

          console.log("Updating invitation status");
          await conn.queryObject(
            "UPDATE invitations SET status = 'accepted' WHERE id = $1",
            [invitationIdFromInvite]
          );
          console.log("Transaction completed successfully for new user");
        });
      } catch (error) {
        console.error("Error in new user patient membership transaction:", error);
        console.error("Error details:", {
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          orgId: orgIdFromInvite,
          userId,
          invitationId: invitationIdFromInvite,
        });
        throw error;
      }

      return {
        kind: "single" as const,
        user_id: userId,
        org_id: validatedOrgId,
        role: "patient" as const,
        email,
      };
    } else {
      userId = userResult.rows[0].user_id;
      email = userResult.rows[0].email;
      
      // Validate userId is a valid UUID
      if (!userId || !isValidUuid(userId)) {
        throw new ConsumerAuthError("Invalid user ID in database", "INVALID_USER_ID");
      }
    }

    // Check existing memberships
    const membershipResult = await conn.queryObject<{ org_id: string; role: string }>(
      "SELECT org_id, role FROM memberships WHERE user_id = $1 AND role = 'patient'",
      [userId]
    );

    if (membershipResult.rows.length === 0) {
      // No membership - look for pending invitation and extract metadata
      // Normalize email to lowercase for case-insensitive matching
      const normalizedEmailForInvite = email.toLowerCase().trim();
      console.log("Looking for invitation for existing user with email:", normalizedEmailForInvite);
      
      // Use SECURITY DEFINER function to bypass RLS (we don't know org_id yet)
      const inviteResult = await conn.queryObject<{
        org_id: string;
        id: string;
        metadata: Record<string, unknown> | null;
        invited_by: string | null;
      }>(
        "SELECT * FROM lookup_invitation_by_email($1)",
        [normalizedEmailForInvite]
      );

      console.log("Invitation lookup result for existing user:", {
        found: inviteResult.rows.length > 0,
        count: inviteResult.rows.length,
        email: normalizedEmailForInvite,
      });

      if (inviteResult.rows.length === 0) {
        throw new ConsumerAuthError("No pending patient invitation found", "NO_INVITATION");
      }

      const orgId = inviteResult.rows[0].org_id;
      const invitationId = inviteResult.rows[0].id;
      const metadata = inviteResult.rows[0].metadata || {};
      const rawInvitedBy = inviteResult.rows[0].invited_by;
      
      // Log the raw value for debugging
      console.log("Raw invited_by value (existing user path):", {
        value: rawInvitedBy,
        type: typeof rawInvitedBy,
        isNull: rawInvitedBy === null,
        isUndefined: rawInvitedBy === undefined,
        stringValue: String(rawInvitedBy),
        length: rawInvitedBy ? String(rawInvitedBy).length : 0,
      });
      
      // Defensively validate: ensure it's a valid UUID string, not empty string or invalid value
      // Handle null, undefined, empty string, and invalid UUIDs
      let invitedBy: string | null = null;
      if (rawInvitedBy != null && typeof rawInvitedBy === 'string') {
        const trimmed = rawInvitedBy.trim();
        if (trimmed !== '' && isValidUuid(trimmed)) {
          invitedBy = trimmed;
        } else {
          console.warn("Invitation has invalid invited_by value", {
            invitationId,
            rawInvitedBy,
            trimmed,
            type: typeof rawInvitedBy,
          });
        }
      }
      
      // Additional validation: ensure orgId is valid
      if (!orgId || typeof orgId !== 'string' || orgId.trim() === '' || !isValidUuid(orgId)) {
        throw new ConsumerAuthError("Invalid organization ID in invitation", "INVALID_INVITATION");
      }
      
      // Ensure orgId is trimmed before use
      const validatedOrgId = orgId.trim();

      console.log("Creating patient membership:", { orgId: validatedOrgId, userId, invitationId });

      // Extract patient data from invitation metadata (provided by clinician during invitation)
      const legalName = typeof metadata.legal_name === "string" ? metadata.legal_name : null;
      const dob = typeof metadata.dob === "string" ? metadata.dob : null;

      // Use withTransaction helper and set RLS context (like authenticateStaff)
      try {
        console.log("Starting transaction");
        await withTransaction(conn, async (conn) => {
          console.log("Inside transaction, setting context");
          await conn.queryObject("SET LOCAL search_path = public");
          await setOrgContext(conn, validatedOrgId);
          
          console.log("Creating membership");
          // Create membership with ON CONFLICT to handle race conditions
          await conn.queryObject(
            `INSERT INTO memberships (org_id, user_id, role, status)
             VALUES ($1, $2, 'patient', 'active')
             ON CONFLICT (org_id, user_id) DO NOTHING`,
            [validatedOrgId, userId]
          );

          console.log("Creating patient record");
          // Create patient record with data from invitation metadata (if provided)
          // legal_name and dob are now nullable, allowing creation without them
          // Patients can fill these in later during onboarding
          const patientResult = await conn.queryObject<{ id: string }>(
            `INSERT INTO patients (org_id, user_id, legal_name, dob)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (org_id, user_id) DO UPDATE SET legal_name = EXCLUDED.legal_name, dob = EXCLUDED.dob
             RETURNING id`,
            [validatedOrgId, userId, legalName, dob]
          );
          
          console.log("Patient result:", patientResult.rows);
          
          if (patientResult.rows.length === 0) {
            throw new Error("Failed to create or retrieve patient record");
          }
          
          const patientId = patientResult.rows[0].id;
          
          // Validate patientId is a valid UUID
          if (!patientId || !isValidUuid(patientId)) {
            throw new Error("Invalid patient ID returned from database");
          }
          
          console.log("Patient ID:", patientId);

          console.log("Creating patient-clinician relationship");
          // Create patient-clinician relationship if the invitation was sent by a clinician
          // Double-check: ensure invitedBy is not null and not empty string
          if (invitedBy && invitedBy.trim() !== '' && isValidUuid(invitedBy)) {
            console.log("Invited by:", invitedBy);
            console.log("Looking up clinician with org_id:", orgId, "user_id:", invitedBy);
            
            // Look up the clinician record for the user who sent the invitation
            const clinicianResult = await conn.queryObject<{ id: string }>(
              "SELECT id FROM clinicians WHERE org_id = $1 AND user_id = $2",
              [validatedOrgId, invitedBy]
            );

            console.log("Clinician lookup result:", clinicianResult.rows);

            if (clinicianResult.rows.length > 0) {
              const clinicianId = clinicianResult.rows[0].id;
              
              // Validate clinicianId is a valid UUID
              if (!clinicianId || !isValidUuid(clinicianId)) {
                console.warn("Invalid clinician ID returned from database", { clinicianId });
                throw new Error("Invalid clinician ID returned from database");
              }
              
              console.log("Linking patient to clinician - patientId:", patientId, "clinicianId:", clinicianId, "orgId:", orgId, "invitedBy:", invitedBy);
              
              await conn.queryObject(
                `INSERT INTO patient_clinicians (patient_id, clinician_id, org_id, active, created_by)
                 VALUES ($1, $2, $3, true, $4)
                 ON CONFLICT (patient_id, clinician_id) DO NOTHING`,
                [patientId, clinicianId, validatedOrgId, invitedBy]
              );
            } else {
              console.log("Inviter is not a clinician, skipping patient-clinician relationship");
            }
          }

          console.log("Updating invitation status");
          // Mark invitation as accepted
          await conn.queryObject(
            "UPDATE invitations SET status = 'accepted' WHERE id = $1",
            [invitationId]
          );
          console.log("Transaction completed successfully");
        });
      } catch (error) {
        console.error("Error in patient membership transaction:", error);
        console.error("Error details:", {
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          orgId,
          userId,
          invitationId,
        });
        throw error;
      }

      return {
        kind: "single" as const,
        user_id: userId,
        org_id: validatedOrgId,
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
