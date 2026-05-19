-- Fix scoring order bug: when a user predicts AFTER a match is already finished,
-- the existing trigger on matches doesn't fire because the match row wasn't updated.
-- This adds two triggers on predictions:
--   1) BEFORE INSERT/UPDATE — sets points_awarded on the row before it's written
--   2) AFTER INSERT/UPDATE  — refreshes the leaderboard once the row is committed
--
-- The split is critical: refresh_leaderboard() must run AFTER the row is written,
-- otherwise it reads stale points_awarded.

-- Drop if re-running
DROP TRIGGER IF EXISTS on_prediction_upsert ON predictions;
DROP TRIGGER IF EXISTS on_prediction_upsert_refresh ON predictions;
DROP FUNCTION IF EXISTS score_single_prediction();
DROP FUNCTION IF EXISTS refresh_leaderboard_after_prediction();

-- 1) BEFORE trigger: score the individual prediction if the match is already finished
CREATE OR REPLACE FUNCTION score_single_prediction()
RETURNS TRIGGER AS $$
DECLARE
  m RECORD;
BEGIN
  SELECT id, home_score, away_score, result, status
  INTO m
  FROM matches
  WHERE id = NEW.match_id;

  IF m.status = 'finished' AND m.result IS NOT NULL
     AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
  THEN
    NEW.points_awarded := CASE
      WHEN NEW.prediction != m.result THEN 0
      WHEN NEW.prediction = m.result
        AND NEW.score_home IS NOT NULL
        AND NEW.score_away IS NOT NULL
        AND NEW.score_home = m.home_score
        AND NEW.score_away = m.away_score
        THEN 5
      WHEN NEW.prediction = m.result THEN 2
      ELSE 0
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER on_prediction_upsert
  BEFORE INSERT OR UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION score_single_prediction();

-- 2) AFTER trigger: refresh the leaderboard now that the row is committed
CREATE OR REPLACE FUNCTION refresh_leaderboard_after_prediction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only refresh if the match is finished (meaning scoring happened)
  IF EXISTS (
    SELECT 1 FROM matches
    WHERE id = NEW.match_id
      AND status = 'finished'
      AND result IS NOT NULL
  ) THEN
    PERFORM refresh_leaderboard();
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER on_prediction_upsert_refresh
  AFTER INSERT OR UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION refresh_leaderboard_after_prediction();
