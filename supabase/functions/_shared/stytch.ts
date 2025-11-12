/**
 * Shared Stytch API Client
 * Purpose: Centralize Stytch API calls with error handling and type safety.
 */
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { PoolClient } from "https://deno.land/x/postgres@v0.17.2/mod.ts";

const STYTCH_PROJECT_ID = Deno.env.get("STYTCH_PROJECT_ID");
const STYTCH_SECRET = Deno.env.get("STYTCH_SECRET");
const STYTCH_ENV = Deno.env.get("STYTCH_ENV"); // 'live' or 'test'

// Consumer API credentials (separate project)
const STYTCH_CONSUMER_PROJECT_ID = Deno.env.get("STYTCH_CONSUMER_PROJECT_ID");
const STYTCH_CONSUMER_SECRET = Deno.env.get("STYTCH_CONSUMER_SECRET");

if (!STYTCH_PROJECT_ID) throw new Error("Missing STYTCH_PROJECT_ID");
if (!STYTCH_SECRET) throw new Error("Missing STYTCH_SECRET");
if (STYTCH_ENV !== "live" && STYTCH_ENV !== "test") {
  throw new Error("Invalid STYTCH_ENV (expected 'live' or 'test')");
}

// Consumer API credentials are optional (only needed for Consumer API calls)
// Log a warning if not set, but don't fail module load
if (!STYTCH_CONSUMER_PROJECT_ID || !STYTCH_CONSUMER_SECRET) {
  console.warn("Consumer API credentials not set. Consumer API calls will fail.");
  console.warn("Set STYTCH_CONSUMER_PROJECT_ID and STYTCH_CONSUMER_SECRET environment variables.");
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
 * Get Basic auth header for Consumer API calls (uses separate Consumer project credentials)
 */
export function getStytchConsumerAuthHeader(): string {
  if (!STYTCH_CONSUMER_PROJECT_ID || !STYTCH_CONSUMER_SECRET) {
    throw new Error("Consumer API credentials not configured. Set STYTCH_CONSUMER_PROJECT_ID and STYTCH_CONSUMER_SECRET.");
  }
  return `Basic ${btoa(`${STYTCH_CONSUMER_PROJECT_ID}:${STYTCH_CONSUMER_SECRET}`)}`;
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

export const StytchConsumerLoginOrCreateResponseSchema = z.object({
  status_code: z.number(),
  request_id: z.string(),
  user_id: z.string(),
  email_id: z.string(),
  user_created: z.boolean().optional(),
}).passthrough();
export type StytchConsumerLoginOrCreateResponse = z.infer<
  typeof StytchConsumerLoginOrCreateResponseSchema
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
  email_address: z.string().optional(), // Some APIs use email_address
  email: z.string().optional(), // Some APIs use email
  verified: z.boolean().optional(),
  primary: z.boolean().optional(),
}).passthrough();
export type StytchConsumerEmailAddress = z.infer<
  typeof StytchConsumerEmailAddressSchema
>;

export const StytchConsumerUserSchema = z.object({
  user_id: z.string(),
  email_addresses: z.array(StytchConsumerEmailAddressSchema),
});
export type StytchConsumerUser = z.infer<typeof StytchConsumerUserSchema>;

// Stytch Consumer API /users/{userId} returns user object directly (not wrapped)
// But it may also include other fields, so we use passthrough to be safe
export const StytchConsumerUserResponseSchema = z.object({
  user_id: z.string(),
  email_addresses: z.array(StytchConsumerEmailAddressSchema).optional(),
  emails: z.array(StytchConsumerEmailAddressSchema).optional(),
}).passthrough();
export type StytchConsumerUserResponse = z.infer<
  typeof StytchConsumerUserResponseSchema
>;

export const StytchConsumerAuthenticateResponseSchema = z.object({
  session: StytchConsumerSessionSchema.optional(),
  user_id: z.string().optional(),
}).passthrough(); // Allow extra fields in case Stytch returns additional data
export type StytchConsumerAuthenticateResponse = z.infer<
  typeof StytchConsumerAuthenticateResponseSchema
>;

export const appendQueryParam = (url: string, key: string, value: string): string => {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
};

/**
 * Stytch API error response
 */
export interface StytchError {
  status_code: number;
  error_type: string;
  error_message: string;
  error_url?: string;
}

type StytchFetchErrorFormatter = (params: {
  response: Response;
  payload: unknown;
  defaultMessage: string;
}) => string;

interface StytchBaseFetchOptions<T> {
  endpoint: string;
  authHeader: string;
  schema: z.ZodType<T>;
  options?: RequestInit;
  timeoutMs?: number;
  invalidJsonMessage: string;
  formatError: StytchFetchErrorFormatter;
  onValidationError?: (payload: unknown, err: unknown) => never;
}

async function stytchBaseFetch<T>({
  endpoint,
  authHeader,
  schema,
  options = {},
  timeoutMs = 10_000,
  invalidJsonMessage,
  formatError,
  onValidationError,
}: StytchBaseFetchOptions<T>): Promise<T> {
  const { signal: externalSignal, headers: optionHeaders, ...restOptions } =
    options;
  const baseUrl = getStytchBaseUrl();

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

  const cleanup = () => {
    clearTimeout(timeoutId);
    if (externalAbortHandler && externalSignal) {
      externalSignal.removeEventListener("abort", externalAbortHandler);
    }
  };

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

    const responseText = await response.text();
    let payload: unknown;
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(`${invalidJsonMessage}: ${responseText}`);
    }

    if (!response.ok) {
      throw new Error(
        formatError({
          response,
          payload,
          defaultMessage: invalidJsonMessage,
        })
      );
    }

    try {
      return schema.parse(payload);
    } catch (err) {
      if (onValidationError) {
        onValidationError(payload, err);
      }
      throw err;
    }
  } finally {
    cleanup();
  }
}

/**
 * Fetch wrapper for Consumer API calls with error handling (uses separate Consumer project credentials)
 */
export async function stytchConsumerFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  schema: z.ZodType<T>,
  timeoutMs = 10_000
): Promise<T> {
  return stytchBaseFetch({
    endpoint,
    authHeader: getStytchConsumerAuthHeader(),
    schema,
    options,
    timeoutMs,
    invalidJsonMessage: "Invalid JSON response from Stytch Consumer API",
    formatError: ({ response, payload }) => {
      const errorData = payload as Partial<StytchError>;
      const message = errorData?.error_message || errorData?.error_type || "Unknown error";
      const detail = errorData?.error_message || "Request failed";
      return `Stytch Consumer API error: ${message} - ${detail}. (${response.status})`;
    },
  });
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
  return stytchBaseFetch({
    endpoint,
    authHeader: getStytchAuthHeader(),
    schema,
    options,
    timeoutMs,
    invalidJsonMessage: "Invalid JSON response from Stytch API",
    formatError: ({ response, payload }) => {
      const data = payload as Partial<StytchError> | undefined;
      const fallbackMessage = response.statusText || `HTTP ${response.status}`;
      const error: StytchError = {
        status_code: data?.status_code ?? response.status,
        error_type: data?.error_type || "unknown",
        error_message: data?.error_message || fallbackMessage,
      };
      return `Stytch API error: ${error.error_type} - ${error.error_message} (${error.status_code})`;
    },
    onValidationError: (payload, err) => {
      const errorDetails = err instanceof Error ? err.message : String(err);
      const zodError = err as { issues?: Array<{ path: string[]; message: string }> };
      const issues =
        zodError.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ') ||
        errorDetails;
      console.error("Stytch response validation failed", err);
      const safePayload = payload !== null && typeof payload === 'object' ? payload : {};
      const redactedPayload = {
        hasMembers: Array.isArray((safePayload as { members?: unknown[] }).members)
          ? ((safePayload as { members?: unknown[] }).members?.length ?? 0)
          : 0,
        hasOrganizations: Array.isArray((safePayload as { organizations?: unknown[] }).organizations)
          ? ((safePayload as { organizations?: unknown[] }).organizations?.length ?? 0)
          : 0,
        hasMetadata: Boolean((safePayload as { results_metadata?: unknown }).results_metadata),
        topLevelKeys: Object.keys(safePayload).filter((k) => !['members', 'organizations'].includes(k)),
      };
      console.error("Response payload summary:", JSON.stringify(redactedPayload));
      throw new Error(`Invalid Stytch API response shape: ${issues}`);
    },
  });
}

/**
 * PKCE code verifier and challenge pair
 */
export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Generate a PKCE code challenge for native callback URLs
 * Creates a random code verifier and derives the code challenge using SHA256
 * Returns both verifier (to store) and challenge (to send to Stytch)
 */
async function generatePKCEPair(): Promise<PKCEPair> {
  // Generate a random code verifier (43-128 characters, URL-safe base64)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // Generate code challenge by SHA256 hashing the verifier and base64url encoding
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const codeChallenge = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return { codeVerifier, codeChallenge };
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
   * Send a login or signup magic link email for B2B members
   * This sends a magic link that can be used to log in (for active members) or sign up (for new/pending members)
   * NOTE: Works with API secret authentication (no member session required).
   * IMPORTANT: Stytch requires billing verification to send emails to external domains.
   * Same-domain emails work without billing verification.
   * NOTE: If native callback URLs are configured (e.g., calico://auth/callback), PKCE is automatically enabled.
   * The code_verifier is stored in the database and will be used during authentication.
   * @param organizationId - Stytch organization ID
   * @param email - Email address of the member
   * @param loginRedirectUrl - Optional URL to redirect to after logging in (native URLs like calico:// are supported with PKCE)
   * @param signupRedirectUrl - Optional URL to redirect to after signing up (native URLs like calico:// are supported with PKCE)
   * @param conn - Optional database connection for storing PKCE verifier (required if using native URLs)
   */
  async sendLoginMagicLink(
    organizationId: string,
    email: string,
    loginRedirectUrl?: string,
    signupRedirectUrl?: string,
    conn?: PoolClient
  ): Promise<StytchB2BSendInviteEmailResponse> {
    const body: Record<string, unknown> = {
      organization_id: organizationId,
      email_address: email,
    };
    
    // Include redirect URLs if provided
    if (loginRedirectUrl) {
      body.login_redirect_url = loginRedirectUrl;
    }
    if (signupRedirectUrl) {
      body.signup_redirect_url = signupRedirectUrl;
    }
    
    // Check if native URLs are being used (require PKCE)
    const isNativeUrl = (url: string) => {
      const normalized = url.toLowerCase();
      return normalized.includes("://") && !normalized.startsWith("http://") && !normalized.startsWith("https://");
    };
    const hasNativeLoginRedirect = !!(loginRedirectUrl && isNativeUrl(loginRedirectUrl));
    const hasNativeSignupRedirect = !!(signupRedirectUrl && isNativeUrl(signupRedirectUrl));
    const needsPKCE = !!conn || hasNativeLoginRedirect || hasNativeSignupRedirect;
    
    // Generate and include PKCE code challenge if native URLs are used
    if (needsPKCE) {
      if (!conn) {
        throw new Error("Database connection required when PKCE is enabled. Pass conn parameter.");
      }
      
      const { codeVerifier, codeChallenge } = await generatePKCEPair();
      body.pkce_code_challenge = codeChallenge;
      body.pkce_code_challenge_method = "S256";
      
      // Store code_verifier in database for later use during authentication
      // Use ON CONFLICT to handle race conditions (multiple invites to same email+org)
      await conn.queryObject(
        `INSERT INTO pkce_verifiers (email, organization_id, code_verifier)
         VALUES ($1, $2, $3)
         ON CONFLICT (email, organization_id) 
         DO UPDATE SET code_verifier = EXCLUDED.code_verifier, expires_at = now() + interval '1 hour'`,
        [email.toLowerCase(), organizationId, codeVerifier]
      );
    }
    
    return stytchFetch(
      `/b2b/magic_links/email/login_or_signup`,
      {
        method: "POST",
        body: JSON.stringify(body),
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
   * Uses login_or_create endpoint which creates the user if they don't exist, or logs them in if they do.
   * NOTE: If native callback URLs are configured (e.g., calico://auth/callback), PKCE is automatically enabled.
   * The code_verifier is stored in the database and will be used during authentication.
   * @param email - Email address of the consumer
   * @param conn - Optional database connection for storing PKCE verifier (required if using native URLs)
   * @param loginMagicLinkUrl - Optional redirect URL for login (defaults to calico://auth/callback)
   * @param signupMagicLinkUrl - Optional redirect URL for signup (defaults to loginMagicLinkUrl)
   */
  async sendMagicLink(
    email: string,
    conn?: PoolClient,
    loginMagicLinkUrl?: string,
    signupMagicLinkUrl?: string
  ): Promise<StytchConsumerLoginOrCreateResponse> {
    // Check if native URLs are being used (require PKCE)
    // Consumer API uses dashboard-configured redirect URLs, so we need to check if PKCE is required
    // For now, we'll always generate PKCE if conn is provided
    const needsPKCE = !!conn;
    
    // Use provided URL or default to native callback URL
    const redirectUrl = loginMagicLinkUrl || "calico://auth/callback";
    const signupUrl = signupMagicLinkUrl || redirectUrl;

    let loginMagicUrl = redirectUrl;
    let signupMagicUrl = signupUrl;

    const body: Record<string, unknown> = {
      email: email.toLowerCase(),
      login_magic_link_url: loginMagicUrl,
      signup_magic_link_url: signupMagicUrl,
    };
    
    // Generate and include PKCE code challenge if database connection is provided
    if (needsPKCE) {
      const { codeVerifier, codeChallenge } = await generatePKCEPair();
      const pkceState = crypto.randomUUID();

      // Add PKCE challenge and append pkce_state to redirect URLs so callbacks can echo it back
      body.code_challenge = codeChallenge;
      body.code_challenge_method = "S256";
      loginMagicUrl = appendQueryParam(loginMagicUrl, "pkce_state", pkceState);
      signupMagicUrl = appendQueryParam(signupMagicUrl, "pkce_state", pkceState);
      body.login_magic_link_url = loginMagicUrl;
      body.signup_magic_link_url = signupMagicUrl;

      // Store per-send PKCE verifier keyed by pkce_state
      await conn.queryObject(
        `INSERT INTO pkce_verifiers_state (pkce_state, email, organization_id, code_verifier)
         VALUES ($1, $2, $3, $4)`,
        [pkceState, email.toLowerCase(), '00000000-0000-0000-0000-000000000000', codeVerifier]
      );

      // For backward compatibility, also upsert latest per email (optional)
      await conn.queryObject(
        `INSERT INTO pkce_verifiers (email, organization_id, code_verifier)
         VALUES ($1, $2, $3)
         ON CONFLICT (email, organization_id)
         DO UPDATE SET code_verifier = EXCLUDED.code_verifier, expires_at = now() + interval '1 hour'`,
        [email.toLowerCase(), '00000000-0000-0000-0000-000000000000', codeVerifier]
      );
    }
    
    return stytchConsumerFetch(
      "/magic_links/email/login_or_create",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      StytchConsumerLoginOrCreateResponseSchema
    );
  },

  /**
   * Authenticate a Consumer session
   */
  async authenticateSession(
    sessionJwt: string
  ): Promise<StytchConsumerAuthenticateResponse> {
    return stytchConsumerFetch(
      "/sessions/authenticate",
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

    // Stytch Consumer user IDs have format: user-test-{uuid} or user-live-{uuid}
    // Validate format: either full user ID format or just UUID
    const fullUserIdRegex = /^user-(test|live)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!fullUserIdRegex.test(trimmedUserId) && !uuidRegex.test(trimmedUserId)) {
      throw new Error(
        `Invalid userId format: expected Stytch Consumer user ID (user-test-{uuid} or user-live-{uuid}) or UUID format, got "${trimmedUserId}"`
      );
    }

    // Stytch Consumer API uses /users/{userId} endpoint
    // Note: baseUrl already includes /v1, so we use /users/ not /v1/users/
    // The API accepts the full user ID format (with prefix)
    return stytchConsumerFetch(
      `/users/${trimmedUserId}`,
      {
        method: "GET",
      },
      StytchConsumerUserResponseSchema
    );
  },
};
