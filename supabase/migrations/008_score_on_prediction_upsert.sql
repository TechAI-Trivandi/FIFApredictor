-- Fix scoring order bug: when a user predicts AFTER a match is already finished,
-- the existing trigger on matches doesn't fire because the match row wasn't updated.
-- This new trigger fires on prediction INSERT/UPDATE and scores immediately if the
-- match is already finished.

CREATE OR REPLACE FUNCTION score_single_prediction()
RETURNS TRIGGER AS $$
DECLARE
  m RECORD;
BEGIN
  -- Look up the match
  SELECT id, home_score, away_score, result, status
  INTO m
  FROM matches
  WHERE id = NEW.match_id;

  -- Only score if match is finished with a result
  IF m.status = 'finished' AND m.result IS NOT NULL
     AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
  THEN
    NEW.points_awarded := CASE
      -- Wrong outcome: 0 pts
      WHEN NEW.prediction != m.result THEN 0
      -- Correct outcome AND exact score: 5 pts
      WHEN NEW.prediction = m.result
        AND NEW.score_home IS NOT NULL
        AND NEW.score_away IS NOT NULL
        AND NEW.score_home = m.home_score
        AND NEW.score_away = m.away_score
        THEN 5
      -- Correct outcome only: 2 pts
      WHEN NEW.prediction = m.result THEN 2
      ELSE 0
    END;

    -- Refresh the leaderboard
    PERFORM refresh_leaderboard();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Fire BEFORE INSERT OR UPDATE so we can modify NEW.points_awarded in-place
CREATE TRIGGER on_prediction_upsert
  BEFORE INSERT OR UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION score_single_prediction();
