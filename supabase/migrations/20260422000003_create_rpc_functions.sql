-- RPC function used by the submit-session Edge Function to atomically
-- increment a season's total_money_earned and return the updated value.
CREATE OR REPLACE FUNCTION increment_season_money(p_season_id int, p_amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'p_amount must be non-negative, got: %', p_amount;
  END IF;

  UPDATE seasons
  SET total_money_earned = total_money_earned + p_amount
  WHERE id = p_season_id;

  RETURN (SELECT total_money_earned FROM seasons WHERE id = p_season_id);
END;
$$;

-- Grant execute to the service role used by Edge Functions
GRANT EXECUTE ON FUNCTION increment_season_money(int, int) TO service_role;
