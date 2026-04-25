-- Add upper bound constraint on sessions.lost
ALTER TABLE sessions
  ADD CONSTRAINT sessions_lost_max CHECK (lost <= 200);
