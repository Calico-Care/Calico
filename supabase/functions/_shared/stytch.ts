/**
 * Shared Stytch API Client
 * Purpose: Centralize Stytch API calls with error handling and type safety.
 */

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
export interface StytchB2BOrganization {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
}

export interface StytchB2BOrganizationResponse {
  organization?: StytchB2BOrganization;
  organization_id?: string;
}

export interface StytchB2BMember {
  member_id: string;
  email_address: string;
  organization_id: string;
}

export interface StytchB2BInviteResponse {
  status_code: number;
  request_id: string;
  member_id: string;
  member?: StytchB2BMember;
  organization?: {
    organization_id: string;
    organization_name: string;
    organization_slug: string;
  };
  email_address?: string; // Deprecated, use member.email_address
}

export interface StytchB2BSession {
  session_id: string;
  member_id: string;
  organization_id: string;
  user_id: string;
}

export interface StytchB2BAuthenticateResponse {
  session?: StytchB2BSession;
  member?: StytchB2BMember;
  organization_id?: string;
}

export interface StytchConsumerMagicLink {
  magic_link_id: string;
}

export interface StytchConsumerMagicLinkResponse {
  magic_link_id?: string;
}

export interface StytchConsumerSession {
  session_id: string;
  user_id: string;
}

export interface StytchConsumerAuthenticateResponse {
  session?: StytchConsumerSession;
  user_id?: string;
}

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
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getStytchBaseUrl();
  const authHeader = getStytchAuthHeader();

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...options.headers,
    },
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

  return response.json() as Promise<T>;
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
    return stytchFetch<StytchB2BOrganizationResponse>("/b2b/organizations", {
      method: "POST",
      body: JSON.stringify({
        organization_name: name,
        organization_slug: slug,
      }),
    });
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
    return stytchFetch<StytchB2BInviteResponse>(
      `/b2b/organizations/${organizationId}/members`,
      {
        method: "POST",
        body: JSON.stringify({
          email_address: email,
          name: name || undefined,
          create_member_as_pending: true, // Require email acceptance before sign-in
          roles: roles || [], // Assign Stytch RBAC roles for API permissions
        }),
      }
    );
  },

  /**
   * Authenticate a B2B session
   */
  async authenticateSession(
    sessionJwt: string
  ): Promise<StytchB2BAuthenticateResponse> {
    return stytchFetch<StytchB2BAuthenticateResponse>(
      "/b2b/sessions/authenticate",
      {
        method: "POST",
        body: JSON.stringify({
          session_jwt: sessionJwt,
        }),
      }
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
    return stytchFetch<StytchConsumerMagicLinkResponse>(
      "/consumers/magic_links/email/send",
      {
        method: "POST",
        body: JSON.stringify({
          email_address: email,
        }),
      }
    );
  },

  /**
   * Authenticate a Consumer session
   */
  async authenticateSession(
    sessionJwt: string
  ): Promise<StytchConsumerAuthenticateResponse> {
    return stytchFetch<StytchConsumerAuthenticateResponse>(
      "/consumers/sessions/authenticate",
      {
        method: "POST",
        body: JSON.stringify({
          session_jwt: sessionJwt,
        }),
      }
    );
  },
};
