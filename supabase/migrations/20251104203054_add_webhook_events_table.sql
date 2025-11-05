-- Create webhook_events table for idempotency tracking
-- Prevents processing duplicate webhook events from Stytch

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_events_event_id_idx ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS webhook_events_event_type_idx ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS webhook_events_processed_at_idx ON webhook_events(processed_at);

-- Grant permissions to app_edge role (only if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_edge') THEN
    GRANT SELECT, INSERT ON webhook_events TO app_edge;
  END IF;
END
$$;

-- Add comment explaining the purpose
COMMENT ON TABLE webhook_events IS 'Tracks processed Stytch webhook events for idempotency. Prevents duplicate processing of the same webhook event.';

