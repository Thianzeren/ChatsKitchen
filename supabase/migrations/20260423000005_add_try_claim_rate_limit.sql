-- Atomic rate-limit claim function.
--
-- Combines the SELECT + UPSERT that the Edge Function previously did as two
-- separate round-trips into a single DB operation, eliminating the race window
-- where two concurrent requests for the same channel could both pass the
-- timestamp check before either write lands.
--
-- Returns TRUE  → slot claimed (caller may proceed)
-- Returns FALSE → window not expired yet (caller should 429)
CREATE OR REPLACE FUNCTION try_claim_rate_limit(
  p_channel    text,
  p_window_ms  int          -- rate-limit window in milliseconds
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claimed boolean;
BEGIN
  INSERT INTO rate_limits (channel_name, last_submission)
  VALUES (p_channel, now())
  ON CONFLICT (channel_name) DO UPDATE
    SET last_submission = now()
    WHERE rate_limits.last_submission < now() - (p_window_ms || ' milliseconds')::interval
  RETURNING true INTO v_claimed;

  -- v_claimed is NULL when the INSERT was blocked by the WHERE clause
  -- (existing row too recent) — treat that as "not claimed"
  RETURN COALESCE(v_claimed, false);
END;
$$;

GRANT EXECUTE ON FUNCTION try_claim_rate_limit(text, int) TO service_role;
