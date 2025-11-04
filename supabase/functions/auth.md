# Staff Authentication Helper Function

## Overview

The shared helper function `authenticateStaff(sessionJwt)` in `supabase/functions/_shared/auth.ts` verifies a Stytch B2B staff session and synchronizes Calico's database state. It is designed to be called by edge functions or other server-side code that needs to authenticate staff users (org admins and clinicians) and synchronize their state with the database.

The same file also exports the `isStytchAuthError(error: Error): boolean` utility function, which detects Stytch API authentication errors by checking error messages for common authentication-related error patterns (invalid_session, unauthorized_credentials, session_not_found, etc.). This utility is used by both `auth-verify-staff` and `auth-verify-consumer` to consistently handle Stytch authentication errors and return appropriate HTTP status codes.

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
  - Stytch API authentication errors (detected via `isStytchAuthError()` utility) → 401 Unauthorized
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

- **401 Unauthorized** – Missing or invalid Authorization header, invalid session JWT (`INVALID_SESSION`), or Stytch API authentication errors (detected via `isStytchAuthError()` utility)
- **404 Not Found** – No pending staff invitation found (`NO_INVITATION`) or organization not found (`ORGANIZATION_NOT_FOUND`)
- **500 Internal Server Error** – Database errors or other unexpected failures

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
  - Creates a `patients` record, pre-populating `legal_name` and `dob` from the invitation's `metadata` if provided by the clinician
  - Marks the pending invitation as `'accepted'`
- **Multi-org support** – Returns a single `org_id` for patients with one organization, or `org_ids` array for patients belonging to multiple organizations.

## Important Notes

- The Stytch Consumer API's `authenticateSession` response does not include email addresses, so the function must call `stytchConsumer.getUser()` to fetch the user's email when creating a new user record.
- The function requires a pending patient invitation in the `invitations` table matching the user's email address. If no invitation is found, it returns a 404 error.
- The function extracts `legal_name` and `dob` from the invitation's `metadata` JSONB field (if provided by the clinician during invitation) and uses them to pre-populate the patient record. If not provided, the patient record is created with `NULL` values, allowing patients to fill them in during onboarding.
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

- **401 Unauthorized** – Missing or invalid Authorization header, invalid session JWT, or Stytch API authentication errors (detected via `isStytchAuthError()` utility)
- **404 Not Found** – No pending patient invitation found for the user's email
- **500 Internal Server Error** – Database errors or other unexpected failures

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
  - `metadata` JSONB field containing optional `legal_name` and `dob` if provided by the clinician
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

1. Attempts to INSERT a new invitation record within the transaction (including metadata if provided)
2. If a unique constraint violation occurs (from the partial unique index `inv_pending_once_per_role`), catches the error
3. If metadata was provided in the request, attempts to UPDATE the existing invitation's metadata by merging the new metadata with the existing metadata using PostgreSQL's JSONB merge operator (`||`)
4. If no metadata was provided or the update fails, queries for the existing pending invitation and returns its ID
5. Both concurrent requests return the same `invitation_id` without errors

This ensures idempotency and prevents 500 errors in high-concurrency scenarios. Note that PostgreSQL's `ON CONFLICT` clause doesn't directly support partial unique indexes, so the function uses try/catch error handling for race condition detection.

## Request Format

```ts
// Request body
type InviteRequest = {
  email: string;
  legal_name?: string; // Optional: Patient legal name provided by clinician
  dob?: string; // Optional: Patient date of birth (ISO 8601 format: YYYY-MM-DD)
};

// Headers
Authorization: Bearer <staff_session_jwt>
Content-Type: application/json
```

**Patient Data Fields:**
- `legal_name` – Optional patient legal name. If provided by the clinician during invitation, it will be pre-populated in the patient record when they sign up. Patients can verify or update this later.
- `dob` – Optional patient date of birth in ISO 8601 format (`YYYY-MM-DD`). If provided by the clinician during invitation, it will be pre-populated in the patient record when they sign up. Patients can verify or update this later.

If these fields are not provided, the patient record will be created with `NULL` values, and patients can fill them in during their onboarding flow.

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

- **400 Bad Request** – Missing or invalid email field, invalid email format, or invalid date of birth format (must be YYYY-MM-DD)
- **401 Unauthorized** – Missing or invalid Authorization header, or invalid session JWT (`StaffAuthError` with code `INVALID_SESSION`)
- **403 Forbidden** – Authenticated user does not have `clinician` or `org_admin` role
- **405 Method Not Allowed** – Request method is not POST
- **500 Internal Server Error** – Database errors, Stytch API errors (for email delivery), authentication state errors (`StaffAuthError` with codes `ORGANIZATION_NOT_FOUND` or `NO_INVITATION`), or other unexpected failures

**Note**: Email delivery failures do not cause the function to return an error. Instead, the function returns HTTP 200 with a `warning` field indicating the email delivery failed. The invitation record is preserved in the database, allowing retries without losing the invitation.

## Important Notes

- **Operation order** – The function creates the database invitation record **before** sending the magic link email. This ensures emails are only sent when a corresponding invitation record exists. The database operation runs within a transaction managed by `withTenant()`, and the email is only sent after the transaction commits successfully.
- **Email failure handling** – If the Stytch Consumer API fails to send the magic link email, the invitation record remains committed in the database. The function returns HTTP 200 with a `warning` field, allowing callers to retry email delivery without losing the invitation. Email errors are logged but do not cause the function to fail.
- **Race condition handling** – The partial unique index `inv_pending_once_per_role` on `invitations(org_id, email, role) WHERE status = 'pending'` ensures only one pending invitation exists per email per organization per role. Concurrent requests are handled by catching unique constraint violations and returning the existing invitation ID.
- **Idempotency** – If a patient already has a pending invitation, subsequent invite requests return the existing invitation ID. If metadata (`legal_name`, `dob`) is provided in a subsequent invite, it will be merged into the existing invitation's metadata using PostgreSQL's JSONB merge operator (`||`), allowing clinicians to update patient information. New metadata fields are added, and existing fields are updated with new values. If the previous invitation's email failed, callers can retry the invite to resend the magic link.
- **Patient data pre-population** – Optional `legal_name` and `dob` fields provided by clinicians during invitation are stored in the invitation's `metadata` JSONB field. When the patient authenticates via `auth-verify-consumer`, this data is used to pre-populate the patient record. If not provided, the patient record is created with `NULL` values, and patients can fill them in during onboarding.
- **RLS and tenant isolation** – The function uses `withTenant()` to ensure all database operations respect Row Level Security (RLS) policies and tenant isolation.
- **Error handling** – The function uses explicit `StaffAuthError` type checking with error code mapping for authentication-related errors, providing more reliable error handling than string matching.

## Typical Usage Flow

1. A clinician or org admin logs into the caregiver/admin app using Stytch B2B authentication.
2. The app displays a form to invite a patient, prompting for the patient's email address.
3. The app sends a POST request to the `patient-invite` edge function with:
   - `Authorization: Bearer <staff_session_jwt>` header
   - JSON body containing `{ "email": "patient@example.com" }` or optionally `{ "email": "patient@example.com", "legal_name": "John Doe", "dob": "1990-01-15" }`
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
- `metadata` – JSONB field containing optional patient data (`legal_name`, `dob`) provided by the clinician
- `created_at` – Timestamp of invitation creation

The invitation is marked as `'accepted'` when the patient authenticates via `auth-verify-consumer` and creates their membership. At that time, any `legal_name` and `dob` values from the invitation metadata are used to populate the `patients` table record. If these fields are not provided, the patient record is created with `NULL` values, allowing patients to fill them in later during onboarding.

---

# Staff Admin Invitation Edge Function

## Overview

The `staff-invite-admin` edge function in `supabase/functions/staff-invite-admin/index.ts` allows Calico operations staff to invite organization administrators to a Stytch B2B organization. It is a server-to-server function designed for internal Calico operations workflows where new organizations need their first admin user invited.

## Responsibilities

- **HTTP endpoint handling** – Accepts POST requests with `Authorization: Bearer <CALICO_OPS_TOKEN>` header and JSON body containing organization and admin details
- **Calico ops authentication** – Verifies the request is authorized using `CALICO_OPS_TOKEN` environment variable
- **Organization lookup** – Resolves the organization's Stytch organization ID using the `admin.get_organization()` SECURITY DEFINER function
- **Email validation** – Validates email format using a basic regex pattern
- **Stytch B2B invitation** – Invites the admin to the Stytch B2B organization via `stytchB2B.inviteMember()` with the `stytch_admin` role, enabling them to invite clinicians
- **Invitation record creation** – Creates a pending invitation record in the `invitations` table (within a transaction) with:
  - `org_id` from the request
  - `email` of the org admin being invited
  - `role` set to `'org_admin'`
  - `stytch_invitation_id` set to the Stytch member ID returned from the invite
  - `status` set to `'pending'`
  - `invited_by` set to `NULL` (Calico ops operation, not tied to a specific user)

## Operation Order and Transaction Safety

The function follows a strict operation order to ensure data consistency:

1. **Organization lookup** – Verifies the organization exists and has a Stytch mapping
2. **Stytch invitation** – Invites the admin to Stytch B2B organization first
3. **Database operation** – Creates the invitation record within a transaction managed by `withTenant()`
4. **Transaction commits** – Once the database operation succeeds and the transaction commits

This ordering ensures that Stytch invitations are only created when the organization exists, and database records are only created when the Stytch invitation succeeds.

## Request Format

```ts
// Request body
type InviteRequest = {
  org_id: string; // UUID of the Calico organization
  email: string; // Email address of the org admin to invite
  name?: string; // Optional: Name of the org admin
};

// Headers
Authorization: Bearer <CALICO_OPS_TOKEN>
Content-Type: application/json
```

**Admin Fields:**
- `name` – Optional org admin name. If provided, it will be set in Stytch B2B for the member.

## Return Value

```ts
type InviteResponse = {
  ok: true;
  invitation_id: string; // UUID of the created invitation record
  stytch_invitation_id: string; // Stytch member ID (same as member_id from Stytch response)
  email: string; // Email address of the invited admin
};
```

The `invitation_id` can be used by Calico ops tools to track invitation status. The `stytch_invitation_id` is the Stytch member ID, which can be used for future Stytch API operations.

## Error Handling

- **400 Bad Request** – Missing or invalid `org_id` or `email` field, or invalid email format
- **401 Unauthorized** – Missing or invalid Authorization header, or token does not match `CALICO_OPS_TOKEN`
- **404 Not Found** – Organization not found (no matching `org_id` in database)
- **405 Method Not Allowed** – Request method is not POST
- **500 Internal Server Error** – Organization missing Stytch mapping, Stytch API errors (e.g., duplicate member email), database errors, or other unexpected failures

**Note**: Stytch API errors (such as `duplicate_member_email`) are returned as 500 errors with the Stytch error message in the response body. Callers should handle these appropriately, as they indicate the email is already a member of the organization.

## Important Notes

- **Calico ops only** – This function is restricted to Calico operations staff via `CALICO_OPS_TOKEN`. It should not be exposed to end users or client applications.
- **Stytch admin role** – The invited admin receives the `stytch_admin` role in Stytch B2B, which allows them to invite clinicians via the `staff-invite-clinician` function.
- **Organization lookup** – Uses `admin.get_organization()` SECURITY DEFINER function to bypass RLS and look up organization details. This function must exist and be accessible to the database user.
- **Stytch invitation first** – The function invites the admin to Stytch B2B **before** creating the database record. If the Stytch invitation fails (e.g., duplicate email), no database record is created.
- **RLS and tenant isolation** – The invitation record creation uses `withTenant()` to ensure all database operations respect Row Level Security (RLS) policies and tenant isolation.
- **No CORS support** – This is a server-to-server function, so it does not handle CORS preflight requests. OPTIONS requests return 405 Method Not Allowed.
- **Transaction safety** – The invitation record creation runs within a transaction managed by `withTenant()`, ensuring atomicity.

## Typical Usage Flow

1. Calico operations staff needs to invite the first admin for a new organization.
2. The ops tool sends a POST request to the `staff-invite-admin` edge function with:
   - `Authorization: Bearer <CALICO_OPS_TOKEN>` header
   - JSON body containing `{ "org_id": "...", "email": "admin@example.com", "name": "Admin Name" }`
3. On success, the edge function:
   - Verifies the organization exists and has a Stytch mapping
   - Invites the admin to Stytch B2B organization with `stytch_admin` role
   - Creates a pending invitation record in the database
   - Returns `{ "ok": true, "invitation_id": "...", "stytch_invitation_id": "...", "email": "admin@example.com" }`
4. The admin receives an invitation email from Stytch B2B.
5. The admin clicks the invitation link and completes Stytch B2B authentication.
6. After authentication, the admin's app calls `auth-verify-staff` which matches the invitation and creates the admin's membership.

## Database Schema

The function creates records in the `invitations` table with the following structure:

- `id` – UUID primary key (generated)
- `org_id` – UUID reference to the organization (from request)
- `email` – CITEXT email address of the org admin
- `role` – Always `'org_admin'` for this function
- `stytch_invitation_id` – Stytch member ID returned from the B2B invite
- `invited_by` – Always `NULL` for this function (Calico ops operation)
- `status` – Always `'pending'` initially (updated to `'accepted'` by `auth-verify-staff`)
- `created_at` – Timestamp of invitation creation

The invitation is marked as `'accepted'` when the admin authenticates via `auth-verify-staff` and creates their membership. At that time, the admin's membership record is created with role `'org_admin'`, granting them permission to invite clinicians.

---

# Staff Clinician Invitation Edge Function

## Overview

The `staff-invite-clinician` edge function in `supabase/functions/staff-invite-clinician/index.ts` allows organization administrators to invite clinicians to their Stytch B2B organization. It is designed for Expo clients (caregiver/admin apps) where org admins need to invite clinicians to join their organization.

## Responsibilities

- **HTTP endpoint handling** – Accepts POST requests with `Authorization: Bearer <session_jwt>` header and JSON body containing clinician email and optional name
- **CORS support** – Handles CORS preflight requests and includes CORS headers in all responses
- **Staff authentication** – Verifies the staff session JWT using `authenticateStaff()` helper and enforces role-based access control (requires `org_admin` role)
- **Email validation** – Validates email format using a basic regex pattern
- **Name validation** – Validates optional name field (must be string, trimmed, 1-100 characters)
- **Organization lookup** – Resolves the organization's Stytch organization ID from the database
- **Invitation record creation** – Creates a pending invitation record in the `invitations` table (within a transaction) with:
  - `org_id` from the authenticated admin's organization
  - `email` of the clinician being invited
  - `role` set to `'clinician'`
  - `invited_by` set to the admin's `user_id`
  - `status` set to `'pending'`
  - `stytch_invitation_id` initially set to `NULL`, then updated after Stytch API call
- **Stytch B2B invitation** – Invites the clinician to the Stytch B2B organization via `stytchB2B.inviteMember()` with the `stytch_member` role (default permissions)
- **Race condition handling** – Handles concurrent invitation requests gracefully by checking for existing invitations and completing incomplete Stytch calls

## Operation Order and Transaction Safety

The function follows a strict operation order to ensure data consistency:

1. **Database operation first** – Attempts to INSERT a new invitation record within a transaction managed by `withTenant()`
2. **Race condition detection** – If a unique constraint violation occurs, checks for existing invitation:
   - If existing invitation has non-null `stytch_invitation_id` → short-circuit and return immediately (no duplicate Stytch call)
   - If existing invitation has null `stytch_invitation_id` → capture invitation ID and continue to complete Stytch call
3. **Stytch API call** – Calls Stytch B2B `inviteMember()` API (only if not short-circuited)
4. **Database update** – Updates the invitation record with `stytch_invitation_id` from Stytch response
5. **Transaction commits** – Once all operations succeed, the transaction commits

This ordering ensures that:
- Database records are created before external API calls
- If Stytch fails, the transaction rolls back cleanly
- Concurrent requests don't create duplicate Stytch invitations
- Incomplete invitations (DB record exists but Stytch call failed) are completed by subsequent requests

## Race Condition Protection

The function uses a transactional pattern to prevent race conditions and ensure idempotency when multiple admins attempt to invite the same clinician simultaneously:

1. Attempts to INSERT a new invitation record within the transaction
2. If a unique constraint violation occurs (from the partial unique index `inv_pending_once_per_role`), catches the error
3. Queries for the existing pending invitation and checks its `stytch_invitation_id`:
   - **If `stytch_invitation_id` is non-null**: The Stytch invitation was already completed by another request → short-circuit and return the existing invitation immediately (prevents duplicate Stytch API calls)
   - **If `stytch_invitation_id` is null**: The invitation record exists but Stytch call wasn't completed → capture the invitation ID, continue to call Stytch API, update the DB row with the Stytch member ID, then return success
4. Both concurrent requests return the same `invitation_id` without errors

This ensures:
- **Idempotency**: Multiple requests for the same clinician return the same invitation ID
- **No duplicate Stytch calls**: If Stytch was already called, subsequent requests return immediately
- **Completeness**: If a previous request created the DB record but failed before calling Stytch, the next request completes the Stytch call and updates the record

## Request Format

```ts
// Request body
type InviteRequest = {
  email: string;
  name?: string; // Optional: Clinician display name (1-100 characters after trimming)
};

// Headers
Authorization: Bearer <staff_session_jwt> // Must be org_admin session
Content-Type: application/json
```

**Clinician Fields:**
- `email` – Required email address of the clinician to invite
- `name` – Optional clinician display name. If provided, must be a non-empty string, will be trimmed, and must be 100 characters or less. If provided, it will be set in Stytch B2B for the member.

## Return Value

```ts
type InviteResponse = {
  ok: true;
  invitation_id: string; // UUID of the created or existing invitation record
  stytch_invitation_id: string; // Stytch member ID (same as member_id from Stytch response)
};
```

The `invitation_id` can be used by clients to track invitation status or display confirmation messages. The `stytch_invitation_id` is the Stytch member ID, which can be used for future Stytch API operations.

## Error Handling

- **400 Bad Request** – Missing or invalid email field, invalid email format, invalid name type, empty name after trimming, or name exceeding 100 characters
- **401 Unauthorized** – Missing or invalid Authorization header, invalid session JWT (`StaffAuthError` with code `INVALID_SESSION`), or Stytch API authentication errors (detected via `isStytchAuthError()` utility)
- **403 Forbidden** – Authenticated user does not have `org_admin` role
- **404 Not Found** – Organization not found (no matching `org_id` in database) or organization missing Stytch mapping
- **405 Method Not Allowed** – Request method is not POST
- **500 Internal Server Error** – Database errors (including internal errors like missing invitation record after insert), Stytch API errors, authentication state errors (`StaffAuthError` with codes `ORGANIZATION_NOT_FOUND` or `NO_INVITATION`), or other unexpected failures

**Note**: The function uses a custom `StaffInviteError` class for validation and permission errors, providing reliable error handling with explicit status codes. Stytch API errors are detected via `isStytchAuthError()` utility and returned as 401 Unauthorized.

## Important Notes

- **Org admin only** – This function is restricted to organization administrators (`org_admin` role). Clinicians cannot invite other clinicians.
- **Stytch member role** – The invited clinician receives the default `stytch_member` role in Stytch B2B, which provides standard member permissions.
- **Operation order** – The function creates the database invitation record **before** calling the Stytch API. This ensures database consistency - if Stytch fails, the transaction rolls back cleanly.
- **Race condition handling** – The partial unique index `inv_pending_once_per_role` on `invitations(org_id, email, role) WHERE status = 'pending'` ensures only one pending invitation exists per email per organization per role. Concurrent requests are handled by:
  - Short-circuiting if Stytch invitation already exists (non-null `stytch_invitation_id`)
  - Completing incomplete invitations if DB record exists but Stytch call hasn't been made (null `stytch_invitation_id`)
- **Idempotency** – If a clinician already has a pending invitation, subsequent invite requests return the existing invitation ID. If the previous request failed before completing the Stytch call, the next request will complete it.
- **Null safety** – The function includes explicit null guards for `inviteResult` before using it, ensuring type safety without relying on non-null assertions.
- **RLS and tenant isolation** – The function uses `withTenant()` with the admin's `user_id` to ensure all database operations respect Row Level Security (RLS) policies and tenant isolation.
- **Error handling** – The function uses explicit `StaffInviteError` and `StaffAuthError` type checking with error code mapping for reliable error handling, avoiding fragile string matching.

## Typical Usage Flow

1. An org admin logs into the caregiver/admin app using Stytch B2B authentication.
2. The app displays a form to invite a clinician, prompting for the clinician's email address and optional name.
3. The app sends a POST request to the `staff-invite-clinician` edge function with:
   - `Authorization: Bearer <admin_session_jwt>` header
   - JSON body containing `{ "email": "clinician@example.com" }` or optionally `{ "email": "clinician@example.com", "name": "Dr. Jane Smith" }`
4. On success, the edge function:
   - Verifies the admin's session and enforces `org_admin` role
   - Validates email format and optional name field
   - Creates (or retrieves) a pending invitation record within a database transaction
   - Calls Stytch B2B API to invite the clinician (or returns existing invitation if already completed)
   - Updates the invitation record with Stytch member ID
   - Returns `{ "ok": true, "invitation_id": "...", "stytch_invitation_id": "..." }`
5. The clinician receives an invitation email from Stytch B2B.
6. The clinician clicks the invitation link and completes Stytch B2B authentication.
7. After authentication, the clinician's app calls `auth-verify-staff` which matches the invitation and creates the clinician's membership and profile record.

## Database Schema

The function creates records in the `invitations` table with the following structure:

- `id` – UUID primary key (generated)
- `org_id` – UUID reference to the organization (from authenticated admin)
- `email` – CITEXT email address of the clinician
- `role` – Always `'clinician'` for this function
- `stytch_invitation_id` – Stytch member ID returned from the B2B invite (initially NULL, updated after Stytch call)
- `invited_by` – UUID reference to the admin's `user_id`
- `status` – Always `'pending'` initially (updated to `'accepted'` by `auth-verify-staff`)
- `created_at` – Timestamp of invitation creation

The invitation is marked as `'accepted'` when the clinician authenticates via `auth-verify-staff` and creates their membership. At that time, the clinician's membership record is created with role `'clinician'`, and a `clinicians` profile record is created with the organization and user information.

---

# Admin List Invitations Edge Function

## Overview

The `admin-list-invitations` edge function in `supabase/functions/admin-list-invitations/index.ts` allows organization administrators to list staff invitations (org_admin and clinician) for their organization. **Patient invitations are excluded for HIPAA compliance** - patient email addresses contain PHI and should not be accessible to org admins. It is designed for Expo clients (caregiver/admin apps) where org admins need to view and track staff invitation status.

## Responsibilities

- **HTTP endpoint handling** – Accepts GET requests with `Authorization: Bearer <session_jwt>` header
- **CORS support** – Handles CORS preflight requests and includes CORS headers in all responses
- **Staff authentication** – Verifies the staff session JWT using `authenticateStaff()` helper and enforces role-based access control (requires `org_admin` role)
- **Invitation listing** – Queries staff invitations (`org_admin`, `clinician`) for the authenticated admin's organization, ordered by creation date (newest first)
- **HIPAA compliance** – Excludes patient invitations to prevent unauthorized access to PHI (patient email addresses)
- **Tenant isolation** – Uses `withTenant()` with the admin's `user_id` to ensure all database operations respect Row Level Security (RLS) policies and tenant isolation

## Request Format

```ts
// Request body: None (GET request)

// Headers
Authorization: Bearer <staff_session_jwt> // Must be org_admin session
Content-Type: application/json (optional, for response)
```

## Return Value

```ts
type ListResponse = {
  invitations: Invitation[];
};

type Invitation = {
  id: string; // UUID of the invitation
  email: string; // Email address of the invited user
  role: string; // 'org_admin' | 'clinician' (patient invitations excluded for HIPAA compliance)
  status: string; // 'pending' | 'accepted' | 'revoked' | 'expired'
  invited_by: string | null; // UUID of the user who sent the invitation (null for Calico ops invites)
  created_at: string; // ISO timestamp of invitation creation
  stytch_invitation_id?: string | null; // Stytch member ID (for staff invites)
};
```

The response includes only staff invitations (`org_admin`, `clinician`) for the organization. Patient invitations are excluded to comply with HIPAA's Minimum Necessary rule, as patient email addresses contain PHI and org admins typically do not have a legitimate need to access them. Clients can filter or group these invitations by role, status, or other criteria as needed.

## Error Handling

- **401 Unauthorized** – Missing or invalid Authorization header, invalid session JWT (`StaffAuthError` with code `INVALID_SESSION`), or Stytch API authentication errors (detected via `isStytchAuthError()` utility)
- **403 Forbidden** – Authenticated user does not have `org_admin` role
- **404 Not Found** – Organization not found (`StaffAuthError` with code `ORGANIZATION_NOT_FOUND`)
- **405 Method Not Allowed** – Request method is not GET
- **500 Internal Server Error** – Database errors, authentication state errors (`StaffAuthError` with codes `NO_INVITATION`), or other unexpected failures

**Note**: The function uses explicit `StaffAuthError` type checking with error code mapping for reliable error handling. Stytch API errors are detected via `isStytchAuthError()` utility and returned as 401 Unauthorized.

## Important Notes

- **Org admin only** – This function is restricted to organization administrators (`org_admin` role). Clinicians cannot list invitations.
- **HIPAA compliance** – Patient invitations are excluded from the response to comply with HIPAA's Minimum Necessary rule. Patient email addresses contain PHI and org admins (typically IT/administrative staff) do not have a legitimate need to access them. If patient invitation management is needed, it should be handled by clinicians through separate endpoints with proper PHI access controls.
- **Staff invitations only** – The function returns only staff invitations (`org_admin`, `clinician`) within the organization. Clients can filter or group by role and status as needed.
- **Tenant-scoped** – All invitations returned are scoped to the authenticated admin's organization. The function uses `withTenant()` to enforce RLS and ensure data isolation.
- **All statuses included** – The function returns invitations with all statuses (`pending`, `accepted`, `revoked`, `expired`). Clients can filter by status as needed.
- **Ordered by creation date** – Invitations are returned in descending order by `created_at` (newest first), making it easy to see recent invitations first.
- **Nullable fields** – The `invited_by` field can be `null` for invitations created by Calico ops staff (e.g., initial org admin invites). The `stytch_invitation_id` field contains the Stytch member ID for staff invites.
- **RLS and tenant isolation** – The function uses `withTenant()` with the admin's `user_id` to ensure all database operations respect Row Level Security (RLS) policies and tenant isolation.
- **Error handling** – The function uses explicit `StaffAuthError` and `isStytchAuthError()` type checking for reliable error handling, avoiding fragile string matching.

## Typical Usage Flow

1. An org admin logs into the caregiver/admin app using Stytch B2B authentication.
2. The app displays an invitations management page or dashboard.
3. The app sends a GET request to the `admin-list-invitations` edge function with:
   - `Authorization: Bearer <admin_session_jwt>` header
4. On success, the edge function:
   - Verifies the admin's session and enforces `org_admin` role
   - Queries staff invitations (`org_admin`, `clinician`) for the organization (within tenant context)
   - Excludes patient invitations for HIPAA compliance
   - Returns `{ "invitations": [...] }` with invitations ordered by creation date (newest first)
5. The client can filter, group, or display these invitations by role, status, or other criteria as needed.

## Database Schema

The function queries records from the `invitations` table with the following structure:

- `id` – UUID primary key
- `org_id` – UUID reference to the organization (filtered by authenticated admin's org)
- `email` – CITEXT email address of the invited user
- `role` – `'org_admin'` | `'clinician'` (patient invitations excluded for HIPAA compliance)
- `status` – `'pending'` | `'accepted'` | `'revoked'` | `'expired'`
- `invited_by` – UUID reference to the user who sent the invitation (can be NULL for Calico ops invites)
- `stytch_invitation_id` – Stytch member ID for staff invites
- `created_at` – Timestamp of invitation creation (used for ordering)

The function returns only staff invitations for the organization, allowing admins to track staff invitation status, see who invited whom, and monitor the organization's staff invitation history. Patient invitations are excluded to comply with HIPAA's Minimum Necessary rule.
