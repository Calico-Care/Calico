-- ===============================
-- Extensions (Supabase-safe)
-- ===============================
create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- case-insensitive email

-- ===============================
-- Enums
-- ===============================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type org_role as enum ('org_admin','clinician','patient');
  end if;
  if not exists (select 1 from pg_type where typname = 'patient_status') then
    create type patient_status as enum ('active','paused','discharged');
  end if;
end$$;

-- ===============================
-- Organizations (tenants)
-- ===============================
create table if not exists public.organizations (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  stytch_organization_id  text unique,              -- B2B org id from Stytch (optional)
  created_at              timestamptz not null default now()
);

-- ===============================
-- Users (single-org account; Stytch is IdP)
-- ===============================
create table if not exists public.users (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete restrict,
  role             org_role not null,                              -- org_admin | clinician | patient
  is_active        boolean not null default true,

  stytch_user_id   text unique not null,                           -- external IdP user id
  stytch_member_id text unique,                                    -- only for staff via B2B; NULL for patients

  email            citext unique not null,                         -- no SMS-only onboarding
  display_name     text,
  created_at       timestamptz not null default now(),

  -- used to enforce org consistency from profile tables
  unique (id, org_id)
);

create index if not exists users_org_idx
  on public.users (org_id);

create index if not exists users_org_role_active_idx
  on public.users (org_id, role, is_active);

-- ===============================
-- Clinicians (domain profile)
-- ===============================
create table if not exists public.clinicians (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique,      -- ensure one clinician profile per user
  org_id      uuid not null,
  npi         text,                      -- optional
  specialty   text,                      -- optional
  created_at  timestamptz not null default now(),

  -- enforce same-org linkage via composite FK
  foreign key (user_id, org_id) references public.users(id, org_id) on delete cascade,

  -- REQUIRED so FKs from patient_clinicians(org_id, clinician_id) can target (id, org_id)
  unique (id, org_id)
);

create index if not exists clinicians_org_idx
  on public.clinicians (org_id);

create unique index if not exists clinicians_npi_uniq
  on public.clinicians (npi)
  where npi is not null;

-- ===============================
-- Patients (domain profile)
-- ===============================
create table if not exists public.patients (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique,     -- ensure one patient profile per user
  org_id       uuid not null,
  external_ref text,                        -- MRN/clinic id (optional, unique per org)
  dob          date,
  phone_e164   text,
  status       patient_status not null default 'active',
  created_at   timestamptz not null default now(),

  -- enforce same-org linkage via composite FK
  foreign key (user_id, org_id) references public.users(id, org_id) on delete cascade,
  constraint patients_phone_e164_chk
    check (phone_e164 is null or phone_e164 ~ '^\+\d{7,15}$'),

  -- REQUIRED so FKs from patient_clinicians(org_id, patient_id) can target (id, org_id)
  unique (id, org_id)
);

create index if not exists patients_org_idx
  on public.patients (org_id);

create index if not exists patients_org_status_idx
  on public.patients (org_id, status);

create unique index if not exists patients_org_external_ref_uniq
  on public.patients (org_id, external_ref)
  where external_ref is not null;

-- ===============================
-- Patient ↔ Clinician (care team)
-- Enforces same-org links via composite FKs
-- ===============================
create table if not exists public.patient_clinicians (
  patient_id   uuid not null,
  clinician_id uuid not null,
  org_id       uuid not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid,  -- users.id (optional audit)

  primary key (patient_id, clinician_id),

  foreign key (patient_id, org_id)   references public.patients(id, org_id)   on delete cascade,
  foreign key (clinician_id, org_id) references public.clinicians(id, org_id) on delete cascade
);

create index if not exists patient_clinicians_by_patient
  on public.patient_clinicians (org_id, patient_id);

create index if not exists patient_clinicians_by_clinician
  on public.patient_clinicians (org_id, clinician_id);

-- ===============================
-- Row Level Security (RLS)
-- Strategy: backend verifies Stytch session, then sets:
--   SET LOCAL app.org_id = '<org-uuid>';
-- Policies rely on current_setting('app.org_id') to scope rows.
-- ===============================

-- Enable RLS
alter table public.users              enable row level security;
alter table public.clinicians         enable row level security;
alter table public.patients           enable row level security;
alter table public.patient_clinicians enable row level security;
alter table public.organizations      enable row level security;

-- Optional: allow service role (bypass RLS) via Supabase service key in backend.

-- Helper: small function to read org_id setting safely (NULL if missing)
create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.org_id', true), '')::uuid;
$$;

-- Policies
do $policy$
begin
  -- Organizations: only your own org row is visible
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='organizations' and policyname='org_scope_organizations') then
    create policy org_scope_organizations
      on public.organizations
      using (id = public.current_org_id());
  end if;

  -- Users: same org
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='org_scope_users') then
    create policy org_scope_users
      on public.users
      using (org_id = public.current_org_id());
  end if;

  -- Clinicians: same org
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinicians' and policyname='org_scope_clinicians') then
    create policy org_scope_clinicians
      on public.clinicians
      using (org_id = public.current_org_id());
  end if;

  -- Patients: same org
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='patients' and policyname='org_scope_patients') then
    create policy org_scope_patients
      on public.patients
      using (org_id = public.current_org_id());
  end if;

  -- Care team mapping: same org
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='patient_clinicians' and policyname='org_scope_patient_clinicians') then
    create policy org_scope_patient_clinicians
      on public.patient_clinicians
      using (org_id = public.current_org_id());
  end if;
end
$policy$;

-- (Optional) Write policies: keep strict; normally your backend uses the service role.
-- If you want org-scoped clients to write directly, add WITH CHECK mirrors:
--   create policy org_scope_users_write on public.users
--     for insert with check (org_id = public.current_org_id());
-- …repeat for other tables.

-- ===============================
-- Practical checks you’ll enforce in app code (v1)
-- ===============================
-- 1) Only users.role IN ('org_admin','clinician') may have a clinicians row
-- 2) Only users.role = 'patient' may have a patients row
-- 3) Keep users.is_active in sync with access revocations

