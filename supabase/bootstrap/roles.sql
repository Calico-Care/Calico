-- bootstrap/roles.sql
-- Purpose: Local/initial setup script for creating roles used by the Calico Edge Functions.
-- Run manually when setting up a new environment (e.g., local replica of remote DB) before running migrations.

DO $$ BEGIN
  CREATE ROLE app_edge LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN END $$;

DO $$ BEGIN
  CREATE ROLE calico_ops_owner NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN END $$;
