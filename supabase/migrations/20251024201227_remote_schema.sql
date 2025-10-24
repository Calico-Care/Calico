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

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.current_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select nullif(current_setting('app.org_id', true), '')::uuid;
$function$
;



