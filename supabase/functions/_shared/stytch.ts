/**
 * Shared Stytch API Client
 * Purpose: Centralize Stytch API calls with error handling and type safety.
 */
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const STYTCH_PROJECT_ID = Deno.env.get("STYTCH_PROJECT_ID");
const STYTCH_SECRET = Deno.env.get("STYTCH_SECRET");
const STYTCH_ENV = Deno.env.get("STYTCH_ENV"); // 'live' or 'test'

if (!STYTCH_PROJECT_ID) throw new Error("Missing STYTCH_PROJECT_ID");
if (!STYTCH_SECRET) throw new Error("Missing STYTCH_SECRET");
if (STYTCH_ENV !== "live" && STYTCH_ENV !== "test") {
  throw new Error("Invalid STYTCH_ENV (expected 'live' or 'test')");
}

/**
 * Get Stytch API base URL based on environment
 */
export function getStytchBaseUrl(): string {
  return STYTCH_ENV === "live"
    ? "https://api.stytch.com/v1"
    : "https://test.stytch.com/v1";
}

/**
 * Get Basic auth header for Stytch API calls
 */
export function getStytchAuthHeader(): string {
  return `Basic ${btoa(`${STYTCH_PROJECT_ID}:${STYTCH_SECRET}`)}`;
}

/**
 * Type definitions for Stytch API responses
 */
export const StytchB2BOrganizationSchema = z.object({
  organization_id: z.string(),
  organization_name: z.string(),
  organization_slug: z.string(),
});
export type StytchB2BOrganization = z.infer<typeof StytchB2BOrganizationSchema>;

export const StytchB2BOrganizationResponseSchema = z.object({
  organization: StytchB2BOrganizationSchema.optional(),
  organization_id: z.string().optional(),
});
export type StytchB2BOrganizationResponse = z.infer<
  typeof StytchB2BOrganizationResponseSchema
>;

export const StytchB2BMemberSchema = z.object({
  member_id: z.string(),
  email_address: z.string(),
  organization_id: z.string(),
  status: z.string().optional(), // 'pending' | 'active' | 'inactive'
  name: z.string().optional(),
  user_id: z.string().optional(),
}).passthrough(); // Allow extra fields
export type StytchB2BMember = z.infer<typeof StytchB2BMemberSchema>;

export const StytchB2BListOrganizationsResponseSchema = z.object({
  organizations: z.array(StytchB2BOrganizationSchema),
  results_metadata: z.object({
    total: z.number(),
    next_cursor: z.string().nullable().optional(),
  }).optional(),
});
export type StytchB2BListOrganizationsResponse = z.infer<
  typeof StytchB2BListOrganizationsResponseSchema
>;

export const StytchB2BListMembersResponseSchema = z.object({
  members: z.array(StytchB2BMemberSchema),
  results_metadata: z.object({
    total: z.number(),
    next_cursor: z.string().nullable().optional(),
  }).optional(),
}).passthrough(); // Allow extra fields at top level
export type StytchB2BListMembersResponse = z.infer<
  typeof StytchB2BListMembersResponseSchema
>;

export const StytchB2BInviteResponseSchema = z.object({
  status_code: z.number(),
  request_id: z.string(),
  member_id: z.string(),
  member: StytchB2BMemberSchema.optional(),
  organization: z
    .object({
      organization_id: z.string(),
      organization_name: z.string(),
      organization_slug: z.string(),
    })
    .optional(),
  email_address: z.string().optional(),
}).passthrough(); // Allow extra fields
export type StytchB2BInviteResponse = z.infer<
  typeof StytchB2BInviteResponseSchema
>;

export const StytchB2BSendInviteEmailResponseSchema = z.object({
  status_code: z.number(),
  request_id: z.string(),
  member_id: z.string(),
  member: StytchB2BMemberSchema.optional(),
  organization: z
    .object({
      organization_id: z.string(),
      organization_name: z.string(),
      organization_slug: z.string(),
    })
    .optional(),
}).passthrough(); // Allow extra fields
export type StytchB2BSendInviteEmailResponse = z.infer<
  typeof StytchB2BSendInviteEmailResponseSchema
>;

export const StytchB2BMemberSessionSchema = z.object({
  member_session_id: z.string(),
  member_id: z.string(),
  organization_id: z.string(),
  started_at: z.string().optional(),
  last_accessed_at: z.string().optional(),
  expires_at: z.string().optional(),
  roles: z.array(z.string()).optional(),
}).passthrough(); // Allow extra fields
export type StytchB2BMemberSession = z.infer<typeof StytchB2BMemberSessionSchema>;

export const StytchB2BAuthenticateResponseSchema = z.object({
  member_session: StytchB2BMemberSessionSchema.optional(),
  member: StytchB2BMemberSchema.optional(),
  organization_id: z.string().optional(),
  organization: z.object({
    organization_id: z.string(),
    organization_name: z.string(),
    organization_slug: z.string(),
  }).optional(),
}).passthrough(); // Allow extra fields
export type StytchB2BAuthenticateResponse = z.infer<
  typeof StytchB2BAuthenticateResponseSchema
>;

export const StytchConsumerMagicLinkSchema = z.object({
  magic_link_id: z.string(),
});
export type StytchConsumerMagicLink = z.infer<
  typeof StytchConsumerMagicLinkSchema
>;

export const StytchConsumerMagicLinkResponseSchema = z.object({
  magic_link_id: z.string().optional(),
});
export type StytchConsumerMagicLinkResponse = z.infer<
  typeof StytchConsumerMagicLinkResponseSchema
>;

export const StytchConsumerSessionSchema = z.object({
  session_id: z.string(),
  user_id: z.string(),
});
export type StytchConsumerSession = z.infer<
  typeof StytchConsumerSessionSchema
>;

export const StytchConsumerEmailAddressSchema = z.object({
  email_id: z.string(),
  email_address: z.string(),
  verified: z.boolean().optional(),
  primary: z.boolean().optional(),
});
export type StytchConsumerEmailAddress = z.infer<
  typeof StytchConsumerEmailAddressSchema
>;

export const StytchConsumerUserSchema = z.object({
  user_id: z.string(),
  email_addresses: z.array(StytchConsumerEmailAddressSchema),
});
export type StytchConsumerUser = z.infer<typeof StytchConsumerUserSchema>;

export const StytchConsumerUserResponseSchema = z.object({
  user: StytchConsumerUserSchema,
});
export type StytchConsumerUserResponse = z.infer<
  typeof StytchConsumerUserResponseSchema
>;

export const StytchConsumerAuthenticateResponseSchema = z.object({
  session: StytchConsumerSessionSchema.optional(),
  user_id: z.string().optional(),
});
export type StytchConsumerAuthenticateResponse = z.infer<
  typeof StytchConsumerAuthenticateResponseSchema
>;

/**
 * Stytch API error response
 */
export interface StytchError {
  status_code: number;
  error_type: string;
  error_message: string;
  error_url?: string;
}

/**
 * Fetch wrapper for Stytch API calls with error handling
 */
export async function stytchFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  schema: z.ZodType<T>,
  timeoutMs = 10_000
): Promise<T> {
  const { signal: externalSignal, headers: optionHeaders, ...restOptions } =
    options;
  const baseUrl = getStytchBaseUrl();
  const authHeader = getStytchAuthHeader();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(
      new DOMException("Stytch request timed out", "TimeoutError")
    );
  }, timeoutMs);

  let externalAbortHandler: (() => void) | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalAbortHandler = () => {
        controller.abort(
          externalSignal.reason ??
            new DOMException("Request aborted", "AbortError")
        );
      };
      externalSignal.addEventListener("abort", externalAbortHandler, {
        once: true,
      });
    }
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        ...optionHeaders,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let error: StytchError;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = {
          status_code: response.status,
          error_type: "unknown",
          error_message: errorText || `HTTP ${response.status}`,
        };
      }
      throw new Error(
        `Stytch API error: ${error.error_type} - ${error.error_message} (${error.status_code})`
      );
    }

    const payload = await response.json();

    try {
      return schema.parse(payload);
    } catch (err) {
      const errorDetails = err instanceof Error ? err.message : String(err);
      const zodError = err as { issues?: Array<{ path: string[]; message: string }> };
      const issues = zodError.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ') || errorDetails;
      console.error("Stytch response validation failed", err);
      // Log redacted payload info (counts/types only) to avoid PII exposure
      // Guard against null/undefined payload to prevent masking original error
      const safePayload = payload !== null && typeof payload === 'object' ? payload : {};
      const redactedPayload = {
        hasMembers: Array.isArray(safePayload.members) ? safePayload.members.length : 0,
        hasOrganizations: Array.isArray(safePayload.organizations) ? safePayload.organizations.length : 0,
        hasMetadata: !!safePayload.results_metadata,
        topLevelKeys: Object.keys(safePayload).filter(k => !['members', 'organizations'].includes(k)),
      };
      console.error("Response payload summary:", JSON.stringify(redactedPayload));
      throw new Error(`Invalid Stytch API response shape: ${issues}`);
    }
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener("abort", externalAbortHandler);
    }
  }
}

/**
 * B2B API helpers
 */
export const stytchB2B = {
  /**
   * Create a B2B organization
   */
  async createOrganization(
    name: string,
    slug: string
  ): Promise<StytchB2BOrganizationResponse> {
    return stytchFetch(
      "/b2b/organizations",
      {
        method: "POST",
        body: JSON.stringify({
          organization_name: name,
          organization_slug: slug,
        }),
      },
      StytchB2BOrganizationResponseSchema
    );
  },

  /**
   * Invite a member to a B2B organization
   * @param organizationId - Stytch organization ID
   * @param email - Email address of the member to invite
   * @param name - Optional display name
   * @param roles - Optional array of Stytch RBAC roles (e.g., ['stytch_admin'] for org admins)
   */
  async inviteMember(
    organizationId: string,
    email: string,
    name?: string,
    roles?: string[]
  ): Promise<StytchB2BInviteResponse> {
    return stytchFetch(
      `/b2b/organizations/${organizationId}/members`,
      {
        method: "POST",
        body: JSON.stringify({
          email_address: email,
          name: name || undefined,
          create_member_as_pending: true, // Require email acceptance before sign-in
          roles: roles || [], // Assign Stytch RBAC roles for API permissions
        }),
      },
      StytchB2BInviteResponseSchema
    );
  },

  /**
   * Send a magic link invitation email to a B2B member
   * This sends the actual email invitation (inviteMember only creates the member)
   * NOTE: Works with API secret authentication (no member session required).
   * RBAC is only enforced when a member session is passed in headers.
   * IMPORTANT: Stytch requires billing verification to send emails to external domains.
   * Same-domain emails work without billing verification.
   * @param organizationId - Stytch organization ID
   * @param email - Email address of the member to invite
   * @param name - Optional display name
   * @param roles - Optional array of Stytch RBAC roles
   * @param inviteRedirectUrl - Optional URL to redirect to after accepting the invite
   */
  async sendInviteEmail(
    organizationId: string,
    email: string,
    name?: string,
    roles?: string[],
    inviteRedirectUrl?: string
  ): Promise<StytchB2BSendInviteEmailResponse> {
    return stytchFetch(
      `/b2b/magic_links/email/invite`,
      {
        method: "POST",
        body: JSON.stringify({
          organization_id: organizationId,
          email_address: email,
          name: name || undefined,
          roles: roles || [],
          invite_redirect_url: inviteRedirectUrl || undefined,
        }),
      },
      StytchB2BSendInviteEmailResponseSchema
    );
  },

  /**
   * Authenticate a B2B session
   */
  async authenticateSession(
    sessionJwt: string
  ): Promise<StytchB2BAuthenticateResponse> {
    return stytchFetch(
      "/b2b/sessions/authenticate",
      {
        method: "POST",
        body: JSON.stringify({
          session_jwt: sessionJwt,
        }),
      },
      StytchB2BAuthenticateResponseSchema
    );
  },

  /**
   * Get a B2B organization by ID
   * @param organizationId - Stytch organization ID
   * @param sessionJwt - Optional Stytch session JWT for RBAC authentication
   */
  async getOrganization(
    organizationId: string,
    sessionJwt?: string
  ): Promise<StytchB2BOrganizationResponse> {
    const headers: Record<string, string> = {};
    if (sessionJwt) {
      headers["X-Stytch-Member-SessionJWT"] = sessionJwt;
    }
    
    return stytchFetch(
      `/b2b/organizations/${organizationId}`,
      {
        method: "GET",
        headers,
      },
      StytchB2BOrganizationResponseSchema
    );
  },

  /**
   * Search members for B2B organizations
   * Requires at least one organization_id in the organization_ids array
   * @param organizationIds - Array of organization IDs to search
   * @param limit - Maximum number of members to return per page
   * @param sessionJwt - Optional Stytch session JWT for RBAC authentication
   * @param cursor - Optional cursor for pagination (from previous response's results_metadata.next_cursor)
   */
  async searchMembers(
    organizationIds: string[],
    limit = 100,
    sessionJwt?: string,
    cursor?: string | null
  ): Promise<StytchB2BListMembersResponse> {
    // Validate that at least one organization ID is provided
    if (!Array.isArray(organizationIds) || organizationIds.length === 0) {
      throw new Error("searchMembers requires at least one non-empty string organization_id in organizationIds");
    }
    
    // Filter out invalid entries: must be strings and non-empty after trimming whitespace
    const validOrganizationIds = organizationIds
      .map((id) => typeof id === 'string' ? id.trim() : null)
      .filter((trimmed): trimmed is string => trimmed !== null && trimmed.length > 0);
    
    // Ensure at least one valid organization ID remains
    if (validOrganizationIds.length === 0) {
      throw new Error("searchMembers requires at least one non-empty string organization_id in organizationIds");
    }
    
    const headers: Record<string, string> = {};
    if (sessionJwt) {
      headers["X-Stytch-Member-SessionJWT"] = sessionJwt;
    }
    
    const body: Record<string, unknown> = {
      organization_ids: validOrganizationIds,
      limit,
    };
    
    if (cursor) {
      body.cursor = cursor;
    }
    
    return stytchFetch(
      "/b2b/organizations/members/search",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      },
      StytchB2BListMembersResponseSchema
    );
  },
};

/**
 * Consumer API helpers
 */
export const stytchConsumer = {
  /**
   * Send a magic link invite to a consumer
   */
  async sendMagicLink(email: string): Promise<StytchConsumerMagicLinkResponse> {
    return stytchFetch(
      "/consumers/magic_links/email/send",
      {
        method: "POST",
        body: JSON.stringify({
          email_address: email,
        }),
      },
      StytchConsumerMagicLinkResponseSchema
    );
  },

  /**
   * Authenticate a Consumer session
   */
  async authenticateSession(
    sessionJwt: string
  ): Promise<StytchConsumerAuthenticateResponse> {
    return stytchFetch(
      "/consumers/sessions/authenticate",
      {
        method: "POST",
        body: JSON.stringify({
          session_jwt: sessionJwt,
        }),
      },
      StytchConsumerAuthenticateResponseSchema
    );
  },

  /**
   * Retrieve a consumer user by id (used to pull email metadata)
   */
  async getUser(userId: string): Promise<StytchConsumerUserResponse> {
    // Fast input validation
    if (typeof userId !== "string") {
      throw new Error("Invalid userId: must be a non-empty string");
    }

    const trimmedUserId = userId.trim();
    if (trimmedUserId.length === 0) {
      throw new Error("Invalid userId: must be a non-empty string");
    }

    // Validate UUID format (Stytch user IDs are UUIDs)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedUserId)) {
      throw new Error(
        `Invalid userId format: expected UUID format, got "${trimmedUserId}"`
      );
    }

    return stytchFetch(
      `/consumers/users/${trimmedUserId}`,
      {
        method: "GET",
      },
      StytchConsumerUserResponseSchema
    );
  },
};
