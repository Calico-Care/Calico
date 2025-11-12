drop function if exists "admin"."create_organization"(p_name text, p_stytch_id text);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION admin.get_membership_by_stytch_member_id(p_stytch_member_id text)
 RETURNS TABLE(id uuid, org_id uuid, user_id uuid, role text, status text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, org_id, user_id, role::text, status::text
  FROM public.memberships
  WHERE stytch_member_id = p_stytch_member_id AND status = 'active';
$function$
;

GRANT EXECUTE ON FUNCTION admin.get_membership_by_stytch_member_id(text) TO app_edge;

CREATE OR REPLACE FUNCTION admin.get_organization(p_org_id uuid)
 RETURNS TABLE(id uuid, name text, stytch_organization_id text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, name, stytch_organization_id, created_at
  FROM public.organizations
  WHERE id = p_org_id;
$function$
;

GRANT EXECUTE ON FUNCTION admin.get_organization(uuid) TO app_edge;

CREATE OR REPLACE FUNCTION admin.list_organizations()
 RETURNS TABLE(id uuid, name text, stytch_organization_id text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, name, stytch_organization_id, created_at
  FROM public.organizations;
$function$
;

GRANT EXECUTE ON FUNCTION admin.list_organizations() TO app_edge;

CREATE OR REPLACE FUNCTION admin.update_organization(p_org_id uuid, p_name text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.organizations
  SET name = p_name
  WHERE id = p_org_id;
$function$
;

GRANT EXECUTE ON FUNCTION admin.update_organization(uuid, text) TO app_edge;

GRANT USAGE ON SCHEMA admin TO app_edge;


revoke delete on table "public"."clinicians" from "anon";

revoke insert on table "public"."clinicians" from "anon";

revoke references on table "public"."clinicians" from "anon";

revoke select on table "public"."clinicians" from "anon";

revoke trigger on table "public"."clinicians" from "anon";

revoke truncate on table "public"."clinicians" from "anon";

revoke update on table "public"."clinicians" from "anon";

revoke delete on table "public"."clinicians" from "authenticated";

revoke insert on table "public"."clinicians" from "authenticated";

revoke references on table "public"."clinicians" from "authenticated";

revoke select on table "public"."clinicians" from "authenticated";

revoke trigger on table "public"."clinicians" from "authenticated";

revoke truncate on table "public"."clinicians" from "authenticated";

revoke update on table "public"."clinicians" from "authenticated";

revoke delete on table "public"."clinicians" from "service_role";

revoke insert on table "public"."clinicians" from "service_role";

revoke references on table "public"."clinicians" from "service_role";

revoke select on table "public"."clinicians" from "service_role";

revoke trigger on table "public"."clinicians" from "service_role";

revoke truncate on table "public"."clinicians" from "service_role";

revoke update on table "public"."clinicians" from "service_role";

revoke delete on table "public"."invitations" from "anon";

revoke insert on table "public"."invitations" from "anon";

revoke references on table "public"."invitations" from "anon";

revoke select on table "public"."invitations" from "anon";

revoke trigger on table "public"."invitations" from "anon";

revoke truncate on table "public"."invitations" from "anon";

revoke update on table "public"."invitations" from "anon";

revoke delete on table "public"."invitations" from "authenticated";

revoke insert on table "public"."invitations" from "authenticated";

revoke references on table "public"."invitations" from "authenticated";

revoke select on table "public"."invitations" from "authenticated";

revoke trigger on table "public"."invitations" from "authenticated";

revoke truncate on table "public"."invitations" from "authenticated";

revoke update on table "public"."invitations" from "authenticated";

revoke delete on table "public"."invitations" from "service_role";

revoke insert on table "public"."invitations" from "service_role";

revoke references on table "public"."invitations" from "service_role";

revoke select on table "public"."invitations" from "service_role";

revoke trigger on table "public"."invitations" from "service_role";

revoke truncate on table "public"."invitations" from "service_role";

revoke update on table "public"."invitations" from "service_role";

revoke delete on table "public"."memberships" from "anon";

revoke insert on table "public"."memberships" from "anon";

revoke references on table "public"."memberships" from "anon";

revoke select on table "public"."memberships" from "anon";

revoke trigger on table "public"."memberships" from "anon";

revoke truncate on table "public"."memberships" from "anon";

revoke update on table "public"."memberships" from "anon";

revoke delete on table "public"."memberships" from "authenticated";

revoke insert on table "public"."memberships" from "authenticated";

revoke references on table "public"."memberships" from "authenticated";

revoke select on table "public"."memberships" from "authenticated";

revoke trigger on table "public"."memberships" from "authenticated";

revoke truncate on table "public"."memberships" from "authenticated";

revoke update on table "public"."memberships" from "authenticated";

revoke delete on table "public"."memberships" from "service_role";

revoke insert on table "public"."memberships" from "service_role";

revoke references on table "public"."memberships" from "service_role";

revoke select on table "public"."memberships" from "service_role";

revoke trigger on table "public"."memberships" from "service_role";

revoke truncate on table "public"."memberships" from "service_role";

revoke update on table "public"."memberships" from "service_role";

revoke delete on table "public"."organizations" from "anon";

revoke insert on table "public"."organizations" from "anon";

revoke references on table "public"."organizations" from "anon";

revoke select on table "public"."organizations" from "anon";

revoke trigger on table "public"."organizations" from "anon";

revoke truncate on table "public"."organizations" from "anon";

revoke update on table "public"."organizations" from "anon";

revoke delete on table "public"."organizations" from "authenticated";

revoke insert on table "public"."organizations" from "authenticated";

revoke references on table "public"."organizations" from "authenticated";

revoke select on table "public"."organizations" from "authenticated";

revoke trigger on table "public"."organizations" from "authenticated";

revoke truncate on table "public"."organizations" from "authenticated";

revoke update on table "public"."organizations" from "authenticated";

revoke delete on table "public"."organizations" from "service_role";

revoke insert on table "public"."organizations" from "service_role";

revoke references on table "public"."organizations" from "service_role";

revoke select on table "public"."organizations" from "service_role";

revoke trigger on table "public"."organizations" from "service_role";

revoke truncate on table "public"."organizations" from "service_role";

revoke update on table "public"."organizations" from "service_role";

revoke delete on table "public"."patient_clinicians" from "anon";

revoke insert on table "public"."patient_clinicians" from "anon";

revoke references on table "public"."patient_clinicians" from "anon";

revoke select on table "public"."patient_clinicians" from "anon";

revoke trigger on table "public"."patient_clinicians" from "anon";

revoke truncate on table "public"."patient_clinicians" from "anon";

revoke update on table "public"."patient_clinicians" from "anon";

revoke delete on table "public"."patient_clinicians" from "authenticated";

revoke insert on table "public"."patient_clinicians" from "authenticated";

revoke references on table "public"."patient_clinicians" from "authenticated";

revoke select on table "public"."patient_clinicians" from "authenticated";

revoke trigger on table "public"."patient_clinicians" from "authenticated";

revoke truncate on table "public"."patient_clinicians" from "authenticated";

revoke update on table "public"."patient_clinicians" from "authenticated";

revoke delete on table "public"."patient_clinicians" from "service_role";

revoke insert on table "public"."patient_clinicians" from "service_role";

revoke references on table "public"."patient_clinicians" from "service_role";

revoke select on table "public"."patient_clinicians" from "service_role";

revoke trigger on table "public"."patient_clinicians" from "service_role";

revoke truncate on table "public"."patient_clinicians" from "service_role";

revoke update on table "public"."patient_clinicians" from "service_role";

revoke delete on table "public"."patients" from "anon";

revoke insert on table "public"."patients" from "anon";

revoke references on table "public"."patients" from "anon";

revoke select on table "public"."patients" from "anon";

revoke trigger on table "public"."patients" from "anon";

revoke truncate on table "public"."patients" from "anon";

revoke update on table "public"."patients" from "anon";

revoke delete on table "public"."patients" from "authenticated";

revoke insert on table "public"."patients" from "authenticated";

revoke references on table "public"."patients" from "authenticated";

revoke select on table "public"."patients" from "authenticated";

revoke trigger on table "public"."patients" from "authenticated";

revoke truncate on table "public"."patients" from "authenticated";

revoke update on table "public"."patients" from "authenticated";

revoke delete on table "public"."patients" from "service_role";

revoke insert on table "public"."patients" from "service_role";

revoke references on table "public"."patients" from "service_role";

revoke select on table "public"."patients" from "service_role";

revoke trigger on table "public"."patients" from "service_role";

revoke truncate on table "public"."patients" from "service_role";

revoke update on table "public"."patients" from "service_role";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke delete on table "public"."users" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "authenticated";

revoke select on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke update on table "public"."users" from "authenticated";

revoke delete on table "public"."users" from "service_role";

revoke insert on table "public"."users" from "service_role";

revoke references on table "public"."users" from "service_role";

revoke select on table "public"."users" from "service_role";

revoke trigger on table "public"."users" from "service_role";

revoke truncate on table "public"."users" from "service_role";

revoke update on table "public"."users" from "service_role";

revoke delete on table "public"."webhook_events" from "anon";

revoke insert on table "public"."webhook_events" from "anon";

revoke references on table "public"."webhook_events" from "anon";

revoke select on table "public"."webhook_events" from "anon";

revoke trigger on table "public"."webhook_events" from "anon";

revoke truncate on table "public"."webhook_events" from "anon";

revoke update on table "public"."webhook_events" from "anon";

revoke delete on table "public"."webhook_events" from "authenticated";

revoke insert on table "public"."webhook_events" from "authenticated";

revoke references on table "public"."webhook_events" from "authenticated";

revoke select on table "public"."webhook_events" from "authenticated";

revoke trigger on table "public"."webhook_events" from "authenticated";

revoke truncate on table "public"."webhook_events" from "authenticated";

revoke update on table "public"."webhook_events" from "authenticated";

revoke delete on table "public"."webhook_events" from "service_role";

revoke insert on table "public"."webhook_events" from "service_role";

revoke references on table "public"."webhook_events" from "service_role";

revoke select on table "public"."webhook_events" from "service_role";

revoke trigger on table "public"."webhook_events" from "service_role";

revoke truncate on table "public"."webhook_events" from "service_role";

revoke update on table "public"."webhook_events" from "service_role";

create table "public"."pkce_verifiers" (
    "id" uuid not null default gen_random_uuid(),
    "email" citext not null,
    "organization_id" text not null,
    "code_verifier" text not null,
    "created_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone not null default (now() + '01:00:00'::interval)
);


create table "public"."pkce_verifiers_state" (
    "pkce_state" uuid not null,
    "email" text not null,
    "organization_id" uuid not null,
    "code_verifier" text not null,
    "expires_at" timestamp with time zone not null default (now() + '01:00:00'::interval)
);


CREATE INDEX idx_pkce_verifiers_state_email_org ON public.pkce_verifiers_state USING btree (email, organization_id, expires_at);

CREATE UNIQUE INDEX pkce_verifiers_email_organization_id_key ON public.pkce_verifiers USING btree (email, organization_id);

CREATE INDEX pkce_verifiers_expires_idx ON public.pkce_verifiers USING btree (expires_at);

CREATE INDEX pkce_verifiers_lookup_idx ON public.pkce_verifiers USING btree (email, organization_id, expires_at);

CREATE UNIQUE INDEX pkce_verifiers_pkey ON public.pkce_verifiers USING btree (id);

CREATE UNIQUE INDEX pkce_verifiers_state_pkey ON public.pkce_verifiers_state USING btree (pkce_state);

alter table "public"."pkce_verifiers" add constraint "pkce_verifiers_pkey" PRIMARY KEY using index "pkce_verifiers_pkey";

alter table "public"."pkce_verifiers_state" add constraint "pkce_verifiers_state_pkey" PRIMARY KEY using index "pkce_verifiers_state_pkey";

alter table "public"."pkce_verifiers" add constraint "pkce_verifiers_email_organization_id_key" UNIQUE using index "pkce_verifiers_email_organization_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cleanup_expired_pkce_verifiers()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM pkce_verifiers WHERE expires_at < now();
  DELETE FROM pkce_verifiers_state WHERE expires_at < now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.lookup_invitation_by_email(p_email text)
 RETURNS TABLE(email citext, org_id uuid, id uuid, metadata jsonb, invited_by uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    i.email,
    i.org_id,
    i.id,
    i.metadata,
    i.invited_by as invited_by
  FROM invitations i
  WHERE LOWER(i.email::text) = LOWER(p_email)
    AND i.role = 'patient'
    AND i.status = 'pending'
  LIMIT 1;
END;
$function$
;
