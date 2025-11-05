import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "@/cors.ts";
import { withConn, setOrgContext, withTransaction } from "@/db.ts";

const STYTCH_WEBHOOK_SECRET = Deno.env.get("STYTCH_WEBHOOK_SECRET");

if (!STYTCH_WEBHOOK_SECRET) {
  throw new Error("Missing STYTCH_WEBHOOK_SECRET environment variable");
}

// Stytch webhook secrets may include 'whsec_' prefix - strip it for HMAC
const WEBHOOK_SECRET = STYTCH_WEBHOOK_SECRET.startsWith("whsec_")
  ? STYTCH_WEBHOOK_SECRET.slice(6)
  : STYTCH_WEBHOOK_SECRET;

/**
 * Webhook signature verification error
 */
export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

/**
 * Webhook payload validation error
 */
export class WebhookValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookValidationError";
  }
}

/**
 * Verify Stytch webhook signature using HMAC-SHA256
 * Stytch sends webhook signatures in the X-Stytch-Signature header
 * Format: timestamp,signature (comma-separated)
 * 
 * Security: We MUST use the timestamp from the signature header itself,
 * as it's part of the signed data. Using a separate timestamp header would
 * allow signature validation bypasses.
 */
async function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader) {
    return false;
  }

  try {
    // Extract signature from header (format: timestamp,signature)
    const parts = signatureHeader.split(",");
    if (parts.length !== 2) {
      return false;
    }

    const headerTimestamp = parts[0].trim();
    const headerSignature = parts[1].trim();

    // Validate timestamp freshness to prevent replay attacks
    // Parse timestamp as integer (unix seconds)
    const parsedTimestamp = parseInt(headerTimestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check for parse errors (NaN), negative ages (future timestamps), or stale timestamps (>5 minutes)
    if (isNaN(parsedTimestamp) || parsedTimestamp <= 0) {
      console.error("Invalid webhook timestamp format:", headerTimestamp);
      return false;
    }
    
    const age = currentTime - parsedTimestamp;
    
    // Reject negative ages (future timestamps) or stale timestamps (>5 minutes)
    if (age < 0 || age > 300) {
      console.error(`Webhook timestamp too old or invalid: age=${age} seconds, timestamp=${parsedTimestamp}, current=${currentTime}`);
      return false;
    }

    // Use ONLY the timestamp from the signature header (security requirement)
    // The timestamp is part of the signed data and must match exactly
    const timestamp = headerTimestamp;

    // Create the signed payload: timestamp + "." + payload
    const signedPayload = `${timestamp}.${payload}`;

    // Compute HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(WEBHOOK_SECRET);
    const payloadData = encoder.encode(signedPayload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, payloadData);
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Compare signatures using constant-time comparison
    return constantTimeEquals(computedSignature, headerSignature);
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Stytch webhook event schemas
 */
const StytchWebhookMemberSchema = z.object({
  member_id: z.string(),
  email_address: z.string().email().optional(),
  organization_id: z.string().optional(),
  user_id: z.string().optional(),
}).passthrough();

const StytchWebhookOrganizationSchema = z.object({
  organization_id: z.string(),
  organization_name: z.string().optional(),
  organization_slug: z.string().optional(),
}).passthrough();

const StytchWebhookEventSchema = z.object({
  project_id: z.string(),
  event_id: z.string(),
  action: z.enum(["CREATE", "UPDATE", "DELETE"]),
  object_type: z.string(),
  source: z.string().optional(),
  id: z.string(),
  timestamp: z.string(),
  member: StytchWebhookMemberSchema.optional(),
  organization: StytchWebhookOrganizationSchema.optional(),
}).passthrough();

type StytchWebhookEvent = z.infer<typeof StytchWebhookEventSchema>;
type StytchWebhookMember = z.infer<typeof StytchWebhookMemberSchema>;
type StytchWebhookOrganization = z.infer<typeof StytchWebhookOrganizationSchema>;

interface WebhookResponse {
  ok: boolean;
  event_id?: string;
  error?: string;
}

/**
 * Process webhook event based on object_type and action
 */
async function processWebhookEvent(event: StytchWebhookEvent): Promise<void> {
  const { object_type, action, id, member, organization } = event;

  switch (object_type) {
    case "member":
      await handleMemberEvent(action, id, member);
      break;

    case "organization":
      await handleOrganizationEvent(action, id, organization);
      break;

    default:
      console.log(`Unhandled webhook object_type: ${object_type} (action: ${action})`);
  }
}

/**
 * Handle member-related webhook events
 */
async function handleMemberEvent(
  action: "CREATE" | "UPDATE" | "DELETE",
  memberId: string,
  memberData?: StytchWebhookMember
): Promise<void> {
  if (!memberData) {
    console.warn(`Member event ${action} for ${memberId} missing member data`);
    return;
  }

  switch (action) {
    case "CREATE":
      await handleMemberCreated(memberData);
      break;

    case "UPDATE":
      await handleMemberUpdated(memberData);
      break;

    case "DELETE":
      await handleMemberDeleted(memberId);
      break;
  }
}

/**
 * Handle organization-related webhook events
 */
async function handleOrganizationEvent(
  action: "CREATE" | "UPDATE" | "DELETE",
  organizationId: string,
  organizationData?: StytchWebhookOrganization
): Promise<void> {
  if (!organizationData) {
    console.warn(`Organization event ${action} for ${organizationId} missing organization data`);
    return;
  }

  switch (action) {
    case "CREATE":
      // Organizations are created via orgs-create edge function, not webhooks
      console.log(`Organization ${organizationId} created via webhook (already handled)`);
      break;

    case "UPDATE":
      await handleOrganizationUpdated(organizationId, organizationData);
      break;

    case "DELETE":
      // Handle organization deletion if needed
      console.log(`Organization ${organizationId} deleted via webhook`);
      break;
  }
}

/**
 * Handle member.created webhook event
 * Updates invitation status when a member accepts an invitation
 */
async function handleMemberCreated(member: StytchWebhookMember): Promise<void> {
  if (!member.email_address || !member.organization_id) {
    console.warn("Member created event missing email_address or organization_id");
    return;
  }

  // Find organization by Stytch organization ID
  const orgResult = await withConn(async (conn) => {
    return conn.queryObject<{ id: string }>(
      `SELECT id FROM admin.list_organizations() WHERE stytch_organization_id = $1`,
      [member.organization_id]
    );
  });

  if (orgResult.rows.length === 0) {
    console.warn(`Organization not found for Stytch org ${member.organization_id}`);
    return;
  }

  const orgId = orgResult.rows[0].id;

  // Update invitation status within tenant context
  await withConn(async (conn) => {
    await conn.queryObject("SET LOCAL search_path = public");

    await withTransaction(conn, async (conn) => {
      await setOrgContext(conn, orgId);

      const result = await conn.queryObject<{ id: string }>(
        `UPDATE invitations 
         SET status = 'accepted' 
         WHERE org_id = $1 AND email = $2 AND status = 'pending'
         RETURNING id`,
        [orgId, member.email_address]
      );

      if (result.rows.length > 0) {
        console.log(`Updated invitation ${result.rows[0].id} to accepted for ${member.email_address}`);
      }
    });
  });
}

/**
 * Handle member.updated webhook event
 */
async function handleMemberUpdated(member: StytchWebhookMember): Promise<void> {
  if (!member.email_address || !member.organization_id || !member.member_id) {
    console.warn("Member updated event missing required fields");
    return;
  }

  // Find organization by Stytch organization ID
  const orgResult = await withConn(async (conn) => {
    return conn.queryObject<{ id: string }>(
      `SELECT id FROM admin.list_organizations() WHERE stytch_organization_id = $1`,
      [member.organization_id]
    );
  });

  if (orgResult.rows.length === 0) {
    console.warn(`Organization not found for Stytch org ${member.organization_id}`);
    return;
  }

  const orgId = orgResult.rows[0].id;

  // Update membership if it exists
  await withConn(async (conn) => {
    await conn.queryObject("SET LOCAL search_path = public");

    await withTransaction(conn, async (conn) => {
      await setOrgContext(conn, orgId);
      // Update user email if changed
      if (member.user_id) {
        await conn.queryObject(
          `UPDATE users SET email = $1 WHERE stytch_user_id = $2`,
          [member.email_address, member.user_id]
        );
      }

      // Update membership stytch_member_id if needed
      // First, get the local user_id from users table
      let localUserId: string | null = null;
      if (member.user_id) {
        const userResult = await conn.queryObject<{ id: string }>(
          `SELECT id FROM users WHERE stytch_user_id = $1`,
          [member.user_id]
        );
        if (userResult.rows.length > 0) {
          localUserId = userResult.rows[0].id;
        }
      }

      // Update membership stytch_member_id if needed
      // Use user_id if available, otherwise fallback to email
      if (localUserId) {
        await conn.queryObject(
          `UPDATE memberships 
           SET stytch_member_id = $1 
           WHERE org_id = $2 AND user_id = $3 AND stytch_member_id IS DISTINCT FROM $1`,
          [member.member_id, orgId, localUserId]
        );
      } else {
        // Fallback to email if user_id not available
        await conn.queryObject(
          `UPDATE memberships 
           SET stytch_member_id = $1 
           WHERE org_id = $2 
             AND user_id IN (
               SELECT id FROM users WHERE email = $3
             )
             AND stytch_member_id IS DISTINCT FROM $1`,
          [member.member_id, orgId, member.email_address]
        );
      }
    });
  });
}

/**
 * Handle member.deleted webhook event
 * Deactivates memberships when members are removed from Stytch
 */
async function handleMemberDeleted(memberId: string): Promise<void> {
  // First, find the org_id(s) for this member using SECURITY DEFINER function to bypass RLS
  // (stytch_member_id is unique, so typically one result)
  const membershipResult = await withConn(async (conn) => {
    return conn.queryObject<{ id: string; org_id: string }>(
      `SELECT id, org_id FROM admin.get_membership_by_stytch_member_id($1)`,
      [memberId]
    );
  });

  if (membershipResult.rows.length === 0) {
    console.warn(`No active membership found for member ${memberId}`);
    return;
  }

  // Update membership within tenant context for each org (though typically just one)
  for (const membership of membershipResult.rows) {
    await withConn(async (conn) => {
      await conn.queryObject("SET LOCAL search_path = public");

      await withTransaction(conn, async (conn) => {
        await setOrgContext(conn, membership.org_id);
        const result = await conn.queryObject<{ id: string }>(
          `UPDATE memberships 
           SET status = 'inactive' 
           WHERE org_id = $1 AND stytch_member_id = $2 AND status = 'active'
           RETURNING id`,
          [membership.org_id, memberId]
        );

        if (result.rows.length > 0) {
          console.log(`Deactivated membership ${result.rows[0].id} for member ${memberId} in org ${membership.org_id}`);
        }
      });
    });
  }
}

/**
 * Handle organization.updated webhook event
 * Syncs organization name/slug changes from Stytch
 */
async function handleOrganizationUpdated(
  organizationId: string,
  organization: StytchWebhookOrganization
): Promise<void> {
  if (!organization.organization_name) {
    console.warn(`Organization ${organizationId} update missing organization_name`);
    return;
  }

  // Update organization using SECURITY DEFINER function
  await withConn(async (conn) => {
    const orgResult = await conn.queryObject<{ id: string; name: string }>(
      `SELECT id, name FROM admin.list_organizations() WHERE stytch_organization_id = $1`,
      [organizationId]
    );

    if (orgResult.rows.length === 0) {
      console.warn(`Organization not found for Stytch org ${organizationId}`);
      return;
    }

    const localOrg = orgResult.rows[0];

    // Only update if name changed
    if (organization.organization_name && organization.organization_name !== localOrg.name) {
      await conn.queryObject(
        `SELECT admin.update_organization($1::uuid, $2::text)`,
        [localOrg.id, organization.organization_name]
      );
      console.log(
        `Updated organization ${localOrg.id} name from "${localOrg.name}" to "${organization.organization_name}"`
      );
    }
  });
}

async function handler(req: Request): Promise<Response> {
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
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("X-Stytch-Signature");

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(rawBody, signatureHeader);

    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse and validate webhook payload
    let event: StytchWebhookEvent;
    try {
      const payload = JSON.parse(rawBody);
      event = StytchWebhookEventSchema.parse(payload);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Webhook payload validation failed:", errorMsg);
      throw new WebhookValidationError(`Invalid webhook payload: ${errorMsg}`);
    }

    // Check if event already processed (idempotency check)
    const existingEvent = await withConn(async (conn) => {
      const result = await conn.queryObject<{ event_id: string }>(
        `SELECT event_id FROM webhook_events WHERE event_id = $1`,
        [event.event_id]
      );
      return result.rows.length > 0;
    });

    if (existingEvent) {
      console.log(`Webhook event ${event.event_id} already processed, skipping`);
      const response: WebhookResponse = {
        ok: true,
        event_id: event.event_id,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process webhook event
    await processWebhookEvent(event);

    // Record event as processed only after successful processing
    // This allows retries if processing fails
    try {
      await withConn(async (conn) => {
        await conn.queryObject(
          `INSERT INTO webhook_events (event_id, event_type, processed_at)
           VALUES ($1, $2, NOW())`,
          [event.event_id, `${event.object_type}.${event.action}`]
        );
      });
    } catch (error) {
      // If insert fails (duplicate key), another thread processed it concurrently
      // This is fine - the event was successfully processed
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string }).code;
      
      const isDuplicateKey = errorCode === "23505" || 
        errorMsg.includes("duplicate key") || 
        errorMsg.includes("unique constraint") ||
        errorMsg.includes("webhook_events_event_id_key");
      
      if (!isDuplicateKey) {
        // If it's a different error (e.g., table doesn't exist), log but don't fail
        console.warn("Failed to record webhook event as processed:", errorMsg, errorCode || "");
      }
    }

    const response: WebhookResponse = {
      ok: true,
      event_id: event.event_id,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    if (error instanceof WebhookSignatureError || error instanceof WebhookValidationError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

Deno.serve(handler);
