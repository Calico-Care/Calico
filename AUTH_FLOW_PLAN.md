# Calico Authentication Flow Implementation Plan

## Project Context

Calico is a multi-tenant healthcare platform that manages organizations, clinicians, and patients with strict tenant isolation.

### Actors and Roles

- **Calico Admin** (you/team): Provisions organizations; no tenant context.
- **Org Admin** (hospital IT): Manages clinicians in their org.
- **Clinician**: Staff user who treats patients.
- **Patient**: Consumer user invited by clinicians.

### Identity + Tenancy Model

- **IdP**: Stytch B2B for staff; Stytch Consumer for patients.
- **Global identity**: `users` table (auth-only: `stytch_user_id`, `email`).
  - **Serves all user types**: Maps to Stytch Consumer `user_id` (patients) or Stytch B2B Member's underlying `user_id` (staff).
  - **Why separate**: Stytch B2B Members have a `user_id` field (the underlying Consumer user); we normalize this in `users`.
- **Org-scoped identity**: `memberships` table (`org_id`, `user_id`, `role`, `status`).
  - **Application roles**: `org_admin`, `clinician`, `patient` (controls app behavior, PHI access, business logic).
  - **Stytch RBAC roles**: Separate from application roles; stored in Stytch only (`stytch_admin` for API permissions like inviting members, `stytch_member` for default permissions).
  - **Role assignment**: Org admins get `stytch_admin` role in Stytch + `org_admin` role in `memberships`. Clinicians get `stytch_member` (or no custom role) in Stytch + `clinician` role in `memberships`.
- **Profiles**: `clinicians` and `patients` tables hold domain data.
- **Tenancy boundary**: `org_id` on every PHI/tenant table. RLS enforces `org_id = current_setting('app.org_id')::uuid`.

### Edge Function Boundary

- All reads/writes go through Edge Functions. Frontend never hits Postgres directly.
- **Tenant requests**: Use `withTenant(orgId, ...)`; sets `SET LOCAL app.org_id`.
- **Admin ops**: Use `withConn(...)` and call SECURITY DEFINER functions for org creation; no tenant GUC.

### Lifecycle Flows

1. **Calico provisions an Organization**

   - Trigger: Calico admin dashboard → "Create Organization"
   - External: Stytch B2B `organizations.create` to get `stytch_organization_id`
   - DB: Call `admin.create_organization(name, stytch_id)` (SECURITY DEFINER)
   - Result: Row in `organizations` with Stytch mapping. No tenant context required.

2. **Calico invites an Org Admin**

   - Trigger: Calico admin dashboard → "Invite Org Admin"
   - External: Stytch B2B member invite API for the org
     - Pass `create_member_as_pending: true` (requires email acceptance)
     - Pass `roles: ['stytch_admin']` (grants permission to invite clinicians)
   - DB: Insert `invitations` row with `status='pending'`, `role='org_admin'`
   - Result: Org admin receives Stytch invite email; must accept before signing in
   - DB (on acceptance during first sign-in): Upsert `users(stytch_user_id,email)`. Insert `memberships(org_id,user_id,role='org_admin',status='active')`
   - Constraint: Staff are single-org; partial unique indexes enforce one staff membership per user for `org_admin` and `clinician`.

3. **Org Admin invites Clinicians**

   - Trigger: Org admin dashboard → "Invite Clinician"
   - External: Stytch B2B member invite API
     - Pass `create_member_as_pending: true` (requires email acceptance)
     - Pass `roles: ['stytch_member']` or omit (default permissions)
   - DB: Insert `invitations` row with `status='pending'`, `role='clinician'`
   - Result: Clinician receives Stytch invite email; must accept before signing in
   - DB (on acceptance during first sign-in): Upsert `users`; insert `memberships(role='clinician')`; insert `clinicians(org_id,user_id,...)`
   - RLS: All ops run with `app.org_id` set to the admin's org; policies enforce same-tenant writes.

4. **Clinician authenticates (session verification)**

   - Trigger: Clinician signs in with Stytch B2B in the app
   - Edge fn (`auth-verify-staff`): Verify Stytch session; resolve org via Stytch member/org; set `SET LOCAL app.org_id`; upsert `users`; ensure `memberships` row exists; return minimal session context (`org_id`, `role`).

5. **Clinician creates a Patient**

   - Trigger: Clinician dashboard → "Add Patient"
   - External: Stytch Consumer magic link API (`/consumers/magic_links/email/send`)
   - DB: Insert `invitations` row with `status='pending'`, `role='patient'`
   - Result: Patient receives magic link email (no separate acceptance step; clicking link authenticates them)
   - **Patient login flow**:
     - First login: Patient clicks magic link → authenticated → prompted to set password (optional but recommended)
     - Subsequent logins: Patient can use email + password (or continue using magic links if preferred)
   - DB (on first magic link click/authentication): Upsert `users(stytch_user_id,email)`. Insert `memberships(org_id,user_id,role='patient',status='active')`. Insert `patients(org_id,user_id,PHI...)` (PHI is org-scoped; duplication across orgs allowed). Mark invitation `status='accepted'`.
   - Invariant: `UNIQUE(org_id,user_id)` on `patients` and `memberships` prevents duplicates in the same org.

6. **Assign Clinician ↔ Patient (care team)**

   - Trigger: Clinician selects patient; "Assign to me/assign to X"
   - DB: Insert into `patient_clinicians(patient_id, clinician_id, org_id, active=true)`
   - Guards: Composite FKs ensure patient and clinician belong to the same `org_id`. RLS blocks cross-tenant links.

7. **Patient belongs to multiple Organizations (optional, supported)**

   - Mechanism: Invite the same person from a second org via Stytch Consumer
   - DB: Second `memberships(org_id2,user_id,role='patient')` + second `patients(org_id2,user_id,PHI...)`
   - Reasoning: PHI is org-owned; values can diverge across orgs by design.

8. **Patient leaves an Organization**
   - Mechanism: Set `memberships.status='inactive'` and/or `patients.status='discharged'` in that org
   - Data retention: Rows remain for audit; RLS still applies.

## Database Schema

### Tables

- **organizations**: Tenant registry; Stytch mapping; RLS enabled. Admin insert via SECURITY DEFINER only.
- **users**: Global identity; no PHI; typically no RLS (or service-only access).
  - Maps to Stytch Consumer `user_id` (patients) or Stytch B2B Member's underlying `user_id` (staff).
  - All authenticated users (org admins, clinicians, patients) have a row here.
- **memberships**: Org-scoped roles; `UNIQUE(org_id,user_id)`; partial uniques enforce staff single-org; RLS by `org_id`.
- **clinicians**: Org-scoped staff profile; FK to `memberships(org_id,user_id)`; RLS by `org_id`.
- **patients**: Org-scoped PHI; FK to `memberships(org_id,user_id)`; RLS by `org_id`; `UNIQUE(org_id, external_ref)` optional.
- **patient_clinicians**: Care team mapping; composite FKs `(org_id,id)` to enforce same-tenant links; RLS by `org_id`.
- **invitations**: Optional tracking; RLS by `org_id`.

### RLS Model

- **Policy shape**: On org tables: `USING (org_id = current_setting('app.org_id')::uuid)` and `WITH CHECK` same predicate.
- **Context**: Edge tenant code calls `withTenant(orgId, ...)` to set `app.org_id`. Without it, all tenant queries fail.
- **Organizations special-case**: Admin creation uses `admin.create_organization` SECURITY DEFINER owned by `calico_ops_owner`; EXECUTE granted only to the least-privilege Edge role. No tenant context needed.

### Roles

- **app_edge**: LOGIN role, used by Edge Functions via `APP_DB_URL`. Has base privileges on `public` schema + tables + sequences.
- **calico_ops_owner**: NOLOGIN role, owns `admin.create_organization` and is target of ops-only policies.

## Environment Variables

### Edge Functions

- `STYTCH_PROJECT_ID` - Stytch project ID (test or live)
- `STYTCH_SECRET` - Stytch secret key
- `STYTCH_ENV` - `'test'` or `'live'` (determines API base URL)
- `CALICO_OPS_TOKEN` - Random string for ops-only endpoints
- `APP_DB_URL` - Postgres connection string for `app_edge` role

### Frontend (Expo)

- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key
- Stytch public keys configured via Stytch SDK

## Implementation Plan

### Phase 1: Shared Infrastructure

#### 1.1 Shared Stytch Client (`supabase/functions/_shared/stytch.ts`)

**Purpose**: Centralize Stytch API calls with error handling.

**Responsibilities**:

- Determine API base URL based on `STYTCH_ENV` (`test` vs `live`)
- Build Basic auth headers for server-side calls
- Provide fetch wrapper with error handling
- Type definitions for Stytch responses

**API Endpoints**:

- B2B Organizations: `/b2b/organizations`
- B2B Members: `/b2b/organizations/{organization_id}/members`
- B2B Sessions: `/b2b/sessions/authenticate`
- Consumer Magic Links: `/consumers/magic_links/email/send`
- Consumer Passwords: `/consumers/passwords` (create, authenticate, reset via frontend SDK)
- Consumer Sessions: `/consumers/sessions/authenticate`

**Note**: Password management (create, reset) is typically handled via Stytch's frontend SDK in the client app, not via Edge Functions. Edge Functions only need to verify Consumer sessions.

#### 1.2 Auth Verification Helpers (`supabase/functions/_shared/auth.ts`)

**Purpose**: Verify Stytch sessions and ensure DB state is synchronized.

**Responsibilities**:

**For Staff (B2B)**:

- Given Stytch B2B session JWT from header
- Call Stytch B2B `/sessions/authenticate` or verify function
- Extract: `stytch_user_id`, `email`, `stytch_organization_id`, `stytch_member_id`
- Map `stytch_organization_id` → `org_id` via `organizations` table
- In DB, using `withConn`:
  - Upsert `users` by `stytch_user_id` (update email as latest)
  - Upsert `memberships`:
    - `org_id`, `user_id`
    - `role`: **Infer from `invitations` table** where `email` matches and `status='pending'`. Use the invitation's `role` field (`'org_admin'` or `'clinician'`). **Do not use Stytch member role metadata** (Stytch RBAC roles control API permissions, not application roles).
    - Set `status='active'`
    - Set `stytch_member_id`
  - If `role='clinician'` and no `clinicians` row: Insert `clinicians(org_id, user_id, ...)`
  - Mark invitation `status='accepted'` if found
- Return: `{ user_id, org_id, role, email }`
- **Do not set `app.org_id` here**; that's done per-request in each Edge function using `withTenant`

**For Patients (Consumer)**:

- Given Stytch Consumer session JWT
- Call Stytch Consumer `/sessions/authenticate`
- Extract `stytch_user_id`, `email`
- DB:
  - Upsert `users` by `stytch_user_id`
  - Resolve org:
    - Query `memberships` by `user_id`
    - If exactly one membership: that's `org_id`
    - If none:
      - Look up latest `invitations` where `email` and `role='patient'` and `status='pending'`
      - Use its `org_id`, insert `memberships(org_id, user_id, role='patient', status='active')`
      - Insert `patients(org_id, user_id, ...)` with minimal initial data
      - Mark invitation `status='accepted'`
    - If >1 membership (multi-org patient): Return `{ user_id, org_ids: [uuid1, uuid2], role: 'patient', email }` and let client choose org context, or require client to send `org_id` query param and enforce membership check
- Return: `{ user_id, org_id, role: 'patient', email }` (single org) or `{ user_id, org_ids: [...], role: 'patient', email }` (multi-org)

**Error Handling**:

- Invalid/expired JWTs → 401
- Stytch API failures → 500 with error details
- DB constraint violations → 400/409
- Missing org mapping → 404

### Phase 2: Auth Verification Edge Functions

#### 2.1 `auth-verify-staff` Edge Function

**Purpose**: Verify B2B session and return session context to client.

**Auth**: `Authorization: Bearer <stytch_session_jwt>` (B2B session)

**Behavior**:

- Read header, call staff auth helper
- Response: JSON `{ user_id, org_id, role, email }`
- Client stores this in Zustand and uses `org_id` for UI context

**Error Handling**:

- Missing/invalid JWT → 401
- Auth helper failures → 500

#### 2.2 `auth-verify-patient` Edge Function

**Purpose**: Verify Consumer session and return session context to client.

**Auth**: `Authorization: Bearer <stytch_session_jwt>` (Consumer session)

**Behavior**:

- Same pattern as staff version but using Consumer helper
- Response: JSON `{ user_id, org_id, role: 'patient', email }`

**Error Handling**:

- Same as staff version

### Phase 3: Invitation Edge Functions

#### 3.1 `orgs-create` Edge Function ✅ **ALREADY BUILT**

**Purpose**: Create a tenant organization in Stytch B2B and persist the mapping in Postgres.

**Auth**: Calico-ops only via `CALICO_OPS_TOKEN`

**Behavior**:

- Check `Authorization: Bearer <CALICO_OPS_TOKEN>`
- Input: `{ name, slug }`
- Call Stytch B2B `organizations.create`
- Call `admin.create_organization(name, stytch_organization_id)` via `withConn`
- Return: `{ ok: true, org_id, stytch_organization_id, slug }`

**Location**: `supabase/functions/orgs-create/index.ts`

#### 3.2 `staff-invite-admin` Edge Function

**Purpose**: Calico admin invites an org admin into a Stytch B2B org.

**Auth**: `Authorization: Bearer <CALICO_OPS_TOKEN>`

**Input**: `{ org_id, email, name? }`

**Behavior**:

- Check `CALICO_OPS_TOKEN`
- DB: `withConn` → SELECT `stytch_organization_id` FROM `organizations` WHERE `id = $org_id`
- Stytch: Call B2B `/organizations/{organization_id}/members` invite endpoint
  - Pass `create_member_as_pending: true` (requires email acceptance)
  - Pass `roles: ['stytch_admin']` (grants permission to invite clinicians)
- Insert `invitations` row:
  - `org_id`
  - `email`
  - `role='org_admin'`
  - `stytch_invitation_id` from Stytch (member_id returned on invite)
  - `status='pending'`
  - `invited_by = NULL` (or Calico internal user-id if exists)
- Return: `{ ok: true, invitation_id, stytch_invitation_id }`

**Result**: Org admin receives Stytch invite email and must accept before signing in.

#### 3.3 `staff-invite-clinician` Edge Function

**Purpose**: Org admin invites a clinician to an existing org in Stytch B2B.

**Auth**: `Authorization: Bearer <stytch_session_jwt>` (B2B session)

**Input**: `{ email, name? }` (org_id comes from verified session)

**Behavior**:

- Call staff auth helper to verify session → get `{ org_id, user_id, role }`
- Enforce `role === 'org_admin'` before proceeding
- DB: Use `withTenant(orgId, ...)` to enforce RLS
- Inside callback:
  - Query `organizations` to get `stytch_organization_id`
  - Stytch: Call B2B `/organizations/{organization_id}/members` invite endpoint
    - Pass `create_member_as_pending: true` (requires email acceptance)
    - Pass `roles: ['stytch_member']` or omit (default permissions)
  - Insert `invitations` row:
    - `org_id`, `email`, `role='clinician'`
    - `invited_by=user_id`
    - `stytch_invitation_id`, `status='pending'`
- Return: `{ ok: true, invitation_id, stytch_invitation_id }`

**Result**: Clinician gets invite email and must accept before signing in.

#### 3.4 `patient-invite` Edge Function

**Purpose**: Clinician invites a patient via Stytch Consumer.

**Auth**: `Authorization: Bearer <stytch_session_jwt>` (B2B staff token)

**Input**: `{ email, name? }` (org_id comes from verified session)

**Behavior**:

- Call staff auth helper to get `{ org_id, user_id, role }`
- Require `role === 'clinician'` or `'org_admin'`
- DB + RLS: Use `withTenant(org_id, ...)` for all DB writes
- Stytch: Use Consumer API (`/consumers/magic_links/email/send`) to send invite to patient email
- Insert `invitations` row:
  - `org_id`, `email`, `role='patient'`
  - `invited_by = clinician.user_id`
  - `stytch_invitation_id` (if Consumer returns something; otherwise store correlation ID)
  - `status='pending'`
- Return: `{ ok: true, invitation_id }`

**Result**: Patient receives Consumer magic link.

### Phase 4: Frontend Wiring (Expo)

#### 4.1 Session Storage and State

**SecureStore**:

- Store Stytch session JWT under `stytch_session_staff` or `stytch_session_patient`
- **Never** store tokens in AsyncStorage

**Zustand**:

- Store ephemeral session context: `{ userId, orgId, role, email }`
- Clear on logout

**React Query**:

- Global QueryClient
- Fetch wrapper that:
  - Reads JWT from SecureStore
  - Adds `Authorization: Bearer <jwt>` header to all API requests
  - Handles 401 → clear session and redirect to login

#### 4.2 Login Flows

**Staff Login** (org admins + clinicians):

- UI: "Staff Login" (generic `/login` page)
- **Use Stytch B2B Discovery flow UI component** - Generic login page, user authenticates first, then sees their org(s) to select
  - Even though staff are single-org, Discovery flow is cleaner than requiring org slug in config
  - User authenticates → sees their one org → selects it → session created
  - Supports: Email magic links, passwords, SSO, OAuth (configured per org)
- On success: Stytch gives session JWT
- Store JWT in SecureStore (`stytch_session_staff`)
- Call `auth-verify-staff`:
  - Save returned `{ user_id, org_id, role, email }` in Zustand
- Navigate to staff home

**Patient Login**:

- UI: "Patient Login"
- **Use Stytch Consumer pre-built UI component** for password + magic link flow (or build custom UI)
- **First login**: Patient enters email → receives magic link → clicks link → authenticated → prompted to set password
- **Subsequent logins**: Patient can use email + password (or choose magic link option)
- On success: Get Consumer session JWT
- Store JWT in SecureStore (`stytch_session_patient`)
- Call `auth-verify-patient`:
  - Save returned `{ user_id, org_id, role='patient', email }` (single org) or `{ user_id, org_ids: [...], role='patient', email }` (multi-org)
- If multi-org: Allow patient to select org context
- Navigate to patient home

**App Bootstrap**:

- On app start:
  - Read JWT from SecureStore (check both keys or use a flag)
  - If exists:
    - Call corresponding `auth-verify-*` endpoint
    - If 200: Hydrate Zustand and allow normal navigation
    - If 401: Clear JWT and force login

**Logout**:

- Clear SecureStore JWT
- Reset Zustand session state
- React Query: `queryClient.clear()`

### Phase 5: Tenant Flows via Edge + withTenant

**Pattern for all tenant APIs**:

1. Extract JWT from `Authorization` header
2. Run relevant `auth-verify-*` helper to get `{ org_id, user_id, role }`
3. Wrap DB work in `withTenant(org_id, ...)`:
   - Inside callback, run any queries; RLS ensures only that org's rows are visible
4. Enforce roles in code:
   - Example: `invite-clinician`: require `role === 'org_admin'`
   - Example: `invite-patient`: require `role === 'clinician' || role === 'org_admin'`
   - Example: `list-patients`: clinicians only

### Phase 6: Minimal UIs

**UI Component Strategy**:

- **Use Stytch pre-built UI components for auth flows only**:
  - **Staff login**:
    - **Option 1 (Recommended)**: Use **Discovery flow** - Generic login page (`/login`), user authenticates, then sees their org(s) to select (even if just one org)
    - **Option 2**: Use **Organization flow** - Pass `organizationSlug` in component config (requires knowing org slug from invite email or stored session)
    - Supports: Email magic links, passwords, SSO, OAuth (per org settings)
  - **Patient login**: Stytch Consumer UI component with password + magic link support
    - Supports: Email magic links, passwords (set after first login)
    - **Note**: Consumer API components are separate from B2B components
  - These handle auth methods, MFA, session management, password reset
- **Build custom UI for all application logic**:
  - PHI workflows (patients, clinicians, care teams)
  - Invitation management
  - Org settings (can optionally embed Stytch Admin Portal for auth settings)

**Stytch UI Component Decision**:

- **Discovery flow**: **Recommended for staff** - Generic `/login` page, user authenticates first, then sees their org(s) to select (even if single-org, this is cleaner than requiring org slug)
- **Organization flow**: Alternative - Requires passing `organizationSlug` in config (can get from invite email link or stored session), but Discovery is simpler
- **Consumer components**: Use for patients (separate from B2B components)

**Calico Internal Admin Dashboard** (web):

- Page to create org via `orgs-create`
- Page to invite org admin via `staff-invite-admin`

**Org Admin Dashboard** (staff app or web):

- Requires staff login path
- Page to:
  - See invitations where `role='clinician'`
  - Invite clinician via `staff-invite-clinician`
  - Manage org settings (optionally embed Stytch Admin Portal for SSO/MFA config)

**Clinician Dashboard**:

- Requires staff login path
- Page to:
  - List patients (`patients` table in org)
  - Invite patient via `patient-invite`
  - Manage care team assignments

**Patient App**:

- Uses patient login path
- For now: Show "Welcome, you're enrolled at {org_name}" using `org_id` and `patients` row
- If multi-org: Allow patient to switch org context (re-authenticate if needed)

## Security Invariants

- No superuser/BYPASSRLS credentials in Edge Functions
- Least-privilege Edge role (`app_edge`); RLS forced
- Admin endpoints gated by `CALICO_OPS_TOKEN`
- SECURITY DEFINER functions are minimal and non-exfiltrating
- All tenant queries use `withTenant` to set `app.org_id`
- Frontend never hits Postgres directly (all via Edge Functions)
- JWTs stored in SecureStore (Keychain/Keystore), never AsyncStorage
- No PHI persisted to AsyncStorage

## Implementation Checklist

- [x] `orgs-create` Edge Function
- [x] Shared Stytch client (`_shared/stytch.ts`)
- [ ] Auth verification helpers (`_shared/auth.ts`)
- [ ] `auth-verify-staff` Edge Function
- [ ] `auth-verify-patient` Edge Function
- [x] `staff-invite-admin` Edge Function
- [ ] `staff-invite-clinician` Edge Function
- [ ] `patient-invite` Edge Function
- [ ] Frontend SecureStore setup
- [ ] Frontend Zustand session store
- [ ] Frontend React Query fetch wrapper
- [ ] Frontend Stytch SDK integration (B2B + Consumer)
- [ ] Frontend login flows (staff + patient)
- [ ] Frontend app bootstrap logic
- [ ] Calico admin dashboard UI
- [ ] Org admin dashboard UI
- [ ] Clinician dashboard UI
- [ ] Patient app UI

## Notes

### Authentication Flow Differences

- **Staff (B2B)**: Invite → Email invitation → Accept invitation → Sign in with org's auth methods (email magic link, password, SSO, OAuth)
- **Patients (Consumer)**: Invite → Magic link email → Click link → Authenticated → Set password (optional but recommended)
- **Patient subsequent logins**: Use email + password (or continue using magic links if preferred)

### Role Systems

- **Stytch RBAC roles**: `stytch_admin` (can invite members), `stytch_member` (default). Control API permissions.
- **Application roles**: `org_admin`, `clinician`, `patient`. Stored in `memberships.role`. Control app behavior, PHI access, business logic.
- **Role assignment**: Org admins get `stytch_admin` + `org_admin`. Clinicians get `stytch_member` (or default) + `clinician`.
- **Role inference**: Use `invitations` table's `role` field during session verification, not Stytch member role metadata.

### Users Table

- Serves all user types: Maps to Stytch Consumer `user_id` (patients) or Stytch B2B Member's underlying `user_id` (staff).
- Stytch B2B Members have a `user_id` field (the underlying Consumer user); we normalize this in `users`.

### Other Notes

- **Idempotency**: Auth verification helpers should be safe to call multiple times (use `INSERT ... ON CONFLICT DO UPDATE`)
- **Error Handling**: All Edge Functions should handle Stytch API failures, invalid JWTs, DB constraint violations gracefully
- **Multi-org Patients**: Schema supports it; frontend/backend should handle gracefully (return `org_ids` array and let client choose)
- **Session Type Detection**: Frontend can use separate SecureStore keys (`stytch_session_staff` vs `stytch_session_patient`) or try both endpoints
- **Invitation Status**: When upserting memberships in session verification, mark invitation `status='accepted'`
- **Race Conditions**: Partial unique index on `invitations(org_id, email, role) WHERE status='pending'` prevents duplicate invites

## Testing Strategy

1. **Local Supabase**: Use `supabase start` and `supabase db reset` to test migrations
2. **Stytch Test Environment**: Use `STYTCH_ENV=test` for all development
3. **Edge Function Testing**: Test each function locally with `supabase functions serve`
4. **Integration Testing**: Test full flows:
   - Calico creates org → invites admin → admin invites clinician → clinician invites patient → all can log in
5. **RLS Testing**: Verify tenant isolation by attempting cross-org queries
6. **Error Cases**: Test invalid JWTs, expired sessions, missing org mappings, duplicate invites
