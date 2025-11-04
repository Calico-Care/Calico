# Staff Authentication Edge Function

## Overview

The shared edge helper `authenticateStaff(sessionJwt)` in `supabase/functions/_shared/auth.ts` verifies a Stytch B2B staff session and synchronizes Calico's database state. It is designed for Expo clients (caregiver/admin apps) that have already completed Stytch B2B login and now need Calico tenant context.

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
