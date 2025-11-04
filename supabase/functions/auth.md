# Staff Authentication Helper Function

## Overview

The shared helper function `authenticateStaff(sessionJwt)` in `supabase/functions/_shared/auth.ts` verifies a Stytch B2B staff session and synchronizes Calico's database state. It is designed to be called by edge functions or other server-side code that needs to authenticate staff users (org admins and clinicians) and synchronize their state with the database.

## Responsibilities

- **Session verification** – Calls `stytchB2B.authenticateSession` with the provided JWT and validates that a member, session, and organization were returned.
- **Organization mapping** – Resolves Calico's `org_id` by looking up the Stytch organization identifier returned by Stytch.
- **User synchronization** – Upserts a record in `users` for the Stytch user, ensuring we always have the latest staff email on file.
- **Membership creation/update** – Runs a transaction that:
  - Inserts an active `memberships` row when the user first joins an org.
  - Adds a `clinicians` profile row when the invited role is `clinician`.
  - Marks the pending invitation as `accepted`.
  - Updates `stytch_member_id` if the membership already existed.

## Transactional Safety

All membership, clinician, and invitation updates execute inside an explicit `BEGIN`/`COMMIT` block. Any exception (including network or runtime failures) triggers a rollback so the invitation and membership state cannot diverge.

## Return Value

```ts
type StaffAuthResult = {
  user_id: string;
  org_id: string;
  role: 'org_admin' | 'clinician';
  email: string;
  stytch_member_id: string;
};
```

Clients use this payload to set tenancy context, pick the correct UI, and persist the Stytch member identifier for future API calls.

## Typical Usage Flow

1. The mobile/web app receives a `session_jwt` from Stytch B2B after login.
2. The app sends the JWT to an edge function (e.g., `staff/authenticate`) that internally calls `authenticateStaff(sessionJwt)`.
3. On success, the edge function returns the `StaffAuthResult`, which the client stores in its session context.
4. The client can now call tenant-scoped APIs using the returned `org_id` and role-based capabilities.

If the helper does not find a matching organization or pending invitation, it throws an error, which should be handled by prompting the user to contact support or retry the onboarding flow.

---

# Staff Authentication Edge Function

## Overview

The `auth-verify-staff` edge function in `supabase/functions/auth-verify-staff/index.ts` is an HTTP endpoint that wraps the `authenticateStaff` helper function. It verifies a Stytch B2B staff session and synchronizes Calico's database state for staff users (org admins and clinicians). It is designed for Expo clients (caregiver/admin apps) that have already completed Stytch B2B login and now need Calico tenant context.

## Responsibilities

- **HTTP endpoint handling** – Accepts POST requests with `Authorization: Bearer <session_jwt>` header
- **CORS support** – Handles CORS preflight requests and includes CORS headers in all responses
- **Session verification** – Delegates to `authenticateStaff()` helper which:
  - Verifies the Stytch B2B session JWT
  - Maps Stytch organization to Calico `org_id`
  - Synchronizes user and membership state
  - Creates clinician profile when applicable
- **Error handling** – Maps `StaffAuthError` codes to appropriate HTTP status codes:
  - `INVALID_SESSION` → 401 Unauthorized
  - `NO_INVITATION` → 404 Not Found
  - `ORGANIZATION_NOT_FOUND` → 404 Not Found
  - Unknown errors → 500 Internal Server Error

## Return Value

The function returns the same `StaffAuthResult` type as the `authenticateStaff` helper:

```ts
type StaffAuthResult = {
  user_id: string;
  org_id: string;
  role: 'org_admin' | 'clinician';
  email: string;
  stytch_member_id: string;
};
```

## Error Handling

- **401 Unauthorized** – Missing or invalid Authorization header, or invalid session JWT (`INVALID_SESSION`)
- **404 Not Found** – No pending staff invitation found (`NO_INVITATION`) or organization not found (`ORGANIZATION_NOT_FOUND`)
- **500 Internal Server Error** – Stytch API errors, database errors, or other unexpected failures

## Typical Usage Flow

1. The mobile/web app receives a `session_jwt` from Stytch B2B after login.
2. The app sends the JWT to the `auth-verify-staff` edge function with `Authorization: Bearer <session_jwt>` header.
3. On success, the edge function returns the `StaffAuthResult`, which the client stores in its session context.
4. The client can now call tenant-scoped APIs using the returned `org_id` and role-based capabilities.

If the function does not find a matching organization or pending invitation, it returns an appropriate error status, which should be handled by prompting the user to contact support or retry the onboarding flow.

---

# Patient Authentication Edge Function

## Overview

The `auth-verify-consumer` edge function in `supabase/functions/auth-verify-consumer/index.ts` verifies a Stytch Consumer session and synchronizes Calico's database state for patient users. It is designed for Expo clients (patient/family apps) that have already completed Stytch Consumer login (via magic link or password) and now need Calico tenant context.

## Responsibilities

- **Session verification** – Calls `stytchConsumer.authenticateSession` with the provided JWT and validates that a session and user_id were returned.
- **User synchronization** – Creates or looks up a user record in `users` table by `stytch_user_id`. If the user doesn't exist, fetches their email from Stytch and creates the user record.
- **Invitation handling** – For new users, looks up a pending patient invitation matching their email to determine which organization they belong to.
- **Membership creation** – When a user first authenticates, runs a transaction that:
  - Creates an active `memberships` row with role `'patient'`
  - Creates a `patients` record (minimal initial data)
  - Marks the pending invitation as `'accepted'`
- **Multi-org support** – Returns a single `org_id` for patients with one organization, or `org_ids` array for patients belonging to multiple organizations.

## Important Notes

- The Stytch Consumer API's `authenticateSession` response does not include email addresses, so the function must call `stytchConsumer.getUser()` to fetch the user's email when creating a new user record.
- The function requires a pending patient invitation in the `invitations` table matching the user's email address. If no invitation is found, it returns a 404 error.
- All database operations run within a single connection transaction managed by `withConn` to ensure consistency.

## Return Value

```ts
type AuthResponse =
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
```

Clients use this payload to set tenancy context and pick the correct UI. For multi-org patients, the client should prompt the user to select which organization they want to access. The discriminated union ensures exactly one variant is returned (either `kind: "single"` with `org_id` or `kind: "multi"` with `org_ids`).

## Error Handling

- **401 Unauthorized** – Missing or invalid Authorization header, or invalid session JWT
- **404 Not Found** – No pending patient invitation found for the user's email
- **500 Internal Server Error** – Stytch API errors, database errors, or other unexpected failures

## Typical Usage Flow

1. The mobile/web app receives a `session_jwt` from Stytch Consumer after login (magic link or password).
2. The app sends the JWT to the `auth-verify-consumer` edge function with `Authorization: Bearer <session_jwt>` header.
3. On success, the edge function returns the `AuthResponse`, which the client stores in its session context.
4. The client can now call tenant-scoped APIs using the returned `org_id` (or prompt for `org_ids` selection for multi-org patients).

If the function does not find a pending invitation matching the user's email, it returns a 404 error, which should be handled by prompting the user to contact support or ensuring they were properly invited.
