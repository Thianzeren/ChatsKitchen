-- Seed: initial season
-- Run via: supabase db seed (or supabase db reset which runs this after migrations)
INSERT INTO seasons (number, status, money_goal, total_money_earned, started_at)
VALUES (1, 'active', 500000, 0, '2026-04-22 00:00:00+00')
ON CONFLICT (number) DO NOTHING;
