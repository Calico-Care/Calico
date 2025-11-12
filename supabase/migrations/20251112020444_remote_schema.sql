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


revoke delete on table "public"."pkce_verifiers" from "anon";

revoke insert on table "public"."pkce_verifiers" from "anon";

revoke references on table "public"."pkce_verifiers" from "anon";

revoke select on table "public"."pkce_verifiers" from "anon";

revoke trigger on table "public"."pkce_verifiers" from "anon";

revoke truncate on table "public"."pkce_verifiers" from "anon";

revoke update on table "public"."pkce_verifiers" from "anon";

revoke delete on table "public"."pkce_verifiers" from "authenticated";

revoke insert on table "public"."pkce_verifiers" from "authenticated";

revoke references on table "public"."pkce_verifiers" from "authenticated";

revoke select on table "public"."pkce_verifiers" from "authenticated";

revoke trigger on table "public"."pkce_verifiers" from "authenticated";

revoke truncate on table "public"."pkce_verifiers" from "authenticated";

revoke update on table "public"."pkce_verifiers" from "authenticated";

revoke delete on table "public"."pkce_verifiers" from "service_role";

revoke insert on table "public"."pkce_verifiers" from "service_role";

revoke references on table "public"."pkce_verifiers" from "service_role";

revoke select on table "public"."pkce_verifiers" from "service_role";

revoke trigger on table "public"."pkce_verifiers" from "service_role";

revoke truncate on table "public"."pkce_verifiers" from "service_role";

revoke update on table "public"."pkce_verifiers" from "service_role";

revoke delete on table "public"."pkce_verifiers_state" from "anon";

revoke insert on table "public"."pkce_verifiers_state" from "anon";

revoke references on table "public"."pkce_verifiers_state" from "anon";

revoke select on table "public"."pkce_verifiers_state" from "anon";

revoke trigger on table "public"."pkce_verifiers_state" from "anon";

revoke truncate on table "public"."pkce_verifiers_state" from "anon";

revoke update on table "public"."pkce_verifiers_state" from "anon";

revoke delete on table "public"."pkce_verifiers_state" from "authenticated";

revoke insert on table "public"."pkce_verifiers_state" from "authenticated";

revoke references on table "public"."pkce_verifiers_state" from "authenticated";

revoke select on table "public"."pkce_verifiers_state" from "authenticated";

revoke trigger on table "public"."pkce_verifiers_state" from "authenticated";

revoke truncate on table "public"."pkce_verifiers_state" from "authenticated";

revoke update on table "public"."pkce_verifiers_state" from "authenticated";

revoke delete on table "public"."pkce_verifiers_state" from "service_role";

revoke insert on table "public"."pkce_verifiers_state" from "service_role";

revoke references on table "public"."pkce_verifiers_state" from "service_role";

revoke select on table "public"."pkce_verifiers_state" from "service_role";

revoke trigger on table "public"."pkce_verifiers_state" from "service_role";

revoke truncate on table "public"."pkce_verifiers_state" from "service_role";

revoke update on table "public"."pkce_verifiers_state" from "service_role";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cleanup_expired_pkce_verifiers()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM pkce_verifiers WHERE expires_at < now();
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
    CASE 
      WHEN i.invited_by IS NULL THEN NULL
      WHEN i.invited_by::text = '' THEN NULL
      ELSE i.invited_by
    END as invited_by
  FROM invitations i
  WHERE LOWER(i.email::text) = LOWER(p_email)
    AND i.role = 'patient'
    AND i.status = 'pending'
  LIMIT 1;
END;
$function$
;



