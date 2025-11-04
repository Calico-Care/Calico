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

---

# Patient Invitation Edge Function

## Overview

The `patient-invite` edge function in `supabase/functions/patient-invite/index.ts` allows clinicians and org admins to invite patients to their organization via Stytch Consumer magic links. It is designed for Expo clients (caregiver/admin apps) where staff members need to invite patients to join the platform.

## Responsibilities

- **HTTP endpoint handling** – Accepts POST requests with `Authorization: Bearer <session_jwt>` header and JSON body containing patient email
- **CORS support** – Handles CORS preflight requests and includes CORS headers in all responses
- **Staff authentication** – Verifies the staff session JWT using `authenticateStaff()` helper and enforces role-based access control (requires `clinician` or `org_admin` role)
- **Email validation** – Validates email format using a basic regex pattern
- **Invitation record creation** – Creates a pending invitation record in the `invitations` table (within a transaction) with:
  - `org_id` from the authenticated staff member's organization
  - `email` of the patient being invited
  - `role` set to `'patient'`
  - `invited_by` set to the staff member's `user_id`
  - `status` set to `'pending'`
- **Magic link delivery** – After the database transaction commits successfully, sends a Stytch Consumer magic link email to the patient via `stytchConsumer.sendMagicLink()`
- **Race condition handling** – Handles concurrent invitation requests gracefully by catching unique constraint violations from the partial unique index and returning the existing invitation ID
- **Email failure handling** – If email delivery fails, the invitation record is preserved and a warning is returned, allowing retries without losing the invitation

## Operation Order and Transaction Safety

The function follows a strict operation order to ensure data consistency:

1. **Database operation first** – Creates (or retrieves) the invitation record within a transaction managed by `withTenant()`
2. **Transaction commits** – Once the database operation succeeds and the transaction commits
3. **Email delivery** – Only then sends the Stytch Consumer magic link email
4. **Email failure handling** – If email delivery fails, the invitation record remains committed and a warning is returned

This ordering prevents sending emails when database operations fail, ensuring patients only receive magic links when a corresponding invitation record exists.

## Race Condition Protection

The function uses a transactional pattern to prevent race conditions when multiple staff members attempt to invite the same patient simultaneously:

1. Attempts to INSERT a new invitation record within the transaction
2. If a unique constraint violation occurs (from the partial unique index `inv_pending_once_per_role`), catches the error
3. Queries for the existing pending invitation and returns its ID
4. Both concurrent requests return the same `invitation_id` without errors

This ensures idempotency and prevents 500 errors in high-concurrency scenarios. Note that PostgreSQL's `ON CONFLICT` clause doesn't directly support partial unique indexes, so the function uses try/catch error handling for race condition detection.

## Request Format

```ts
// Request body
type InviteRequest = {
  email: string;
};

// Headers
Authorization: Bearer <staff_session_jwt>
Content-Type: application/json
```

## Return Value

```ts
type InviteResponse = {
  ok: true;
  invitation_id: string; // UUID of the created or existing invitation
  warning?: string; // Optional warning if email delivery failed
};
```

The `invitation_id` can be used by clients to track invitation status or display confirmation messages. If `warning` is present, it indicates that the invitation was created successfully but email delivery failed, and the caller should retry sending the invitation.

## Error Handling

- **400 Bad Request** – Missing or invalid email field, or invalid email format
- **401 Unauthorized** – Missing or invalid Authorization header, or invalid session JWT (`StaffAuthError` with code `INVALID_SESSION`)
- **403 Forbidden** – Authenticated user does not have `clinician` or `org_admin` role
- **405 Method Not Allowed** – Request method is not POST
- **500 Internal Server Error** – Database errors, Stytch API errors (for email delivery), authentication state errors (`StaffAuthError` with codes `ORGANIZATION_NOT_FOUND` or `NO_INVITATION`), or other unexpected failures

**Note**: Email delivery failures do not cause the function to return an error. Instead, the function returns HTTP 200 with a `warning` field indicating the email delivery failed. The invitation record is preserved in the database, allowing retries without losing the invitation.

## Important Notes

- **Operation order** – The function creates the database invitation record **before** sending the magic link email. This ensures emails are only sent when a corresponding invitation record exists. The database operation runs within a transaction managed by `withTenant()`, and the email is only sent after the transaction commits successfully.
- **Email failure handling** – If the Stytch Consumer API fails to send the magic link email, the invitation record remains committed in the database. The function returns HTTP 200 with a `warning` field, allowing callers to retry email delivery without losing the invitation. Email errors are logged but do not cause the function to fail.
- **Race condition handling** – The partial unique index `inv_pending_once_per_role` on `invitations(org_id, email, role) WHERE status = 'pending'` ensures only one pending invitation exists per email per organization per role. Concurrent requests are handled by catching unique constraint violations and returning the existing invitation ID.
- **Idempotency** – If a patient already has a pending invitation, subsequent invite requests return the existing invitation ID. If the previous invitation's email failed, callers can retry the invite to resend the magic link.
- **RLS and tenant isolation** – The function uses `withTenant()` to ensure all database operations respect Row Level Security (RLS) policies and tenant isolation.
- **Error handling** – The function uses explicit `StaffAuthError` type checking with error code mapping for authentication-related errors, providing more reliable error handling than string matching.

## Typical Usage Flow

1. A clinician or org admin logs into the caregiver/admin app using Stytch B2B authentication.
2. The app displays a form to invite a patient, prompting for the patient's email address.
3. The app sends a POST request to the `patient-invite` edge function with:
   - `Authorization: Bearer <staff_session_jwt>` header
   - JSON body containing `{ "email": "patient@example.com" }`
4. On success, the edge function:
   - Creates (or retrieves) a pending invitation record within a database transaction
   - Commits the transaction
   - Sends a magic link email to the patient via Stytch Consumer API
   - Returns `{ "ok": true, "invitation_id": "..." }` or `{ "ok": true, "invitation_id": "...", "warning": "..." }` if email delivery failed
5. If email delivery failed, the caller can retry the invite request to resend the magic link (the invitation record is preserved).
6. The patient receives the magic link email and clicks it to authenticate with Stytch Consumer.
7. After authentication, the patient's app calls `auth-verify-consumer` which matches the invitation and creates the patient's membership.

## Database Schema

The function creates records in the `invitations` table with the following structure:

- `id` – UUID primary key (generated)
- `org_id` – UUID reference to the organization (from authenticated staff member)
- `email` – CITEXT email address of the patient
- `role` – Always `'patient'` for this function
- `invited_by` – UUID reference to the staff member's `user_id`
- `status` – Always `'pending'` initially (updated to `'accepted'` by `auth-verify-consumer`)
- `created_at` – Timestamp of invitation creation

The invitation is marked as `'accepted'` when the patient authenticates via `auth-verify-consumer` and creates their membership.
