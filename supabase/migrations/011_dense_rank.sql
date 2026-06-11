-- Use DENSE_RANK instead of RANK so tied players don't create huge gaps.
--
-- RANK():       19 players on 5pts → rank 1, next tier → rank 20, next → rank 42
-- DENSE_RANK(): 19 players on 5pts → rank 1, next tier → rank 2, next → rank 3
--
-- For a pool with lots of ties early on, dense ranking reads far more naturally
-- (everyone is 1st / 2nd / 3rd by score tier, not 1st / 20th / 42nd).

CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS VOID AS $$
BEGIN
  UPDATE leaderboard SET previous_rank = rank WHERE true;

  DELETE FROM leaderboard WHERE user_id NOT IN (SELECT id FROM profiles);

  INSERT INTO leaderboard
    (user_id, display_name, total_points, correct_predictions,
     total_predictions, rank, weekly_points, updated_at)
  SELECT
    p.id,
    p.display_name,
    COALESCE(SUM(pr.points_awarded), 0)::INTEGER,
    COUNT(*) FILTER (WHERE pr.points_awarded > 0)::INTEGER,
    COUNT(pr.id)::INTEGER,
    DENSE_RANK() OVER (
      ORDER BY COALESCE(SUM(pr.points_awarded), 0) DESC
    )::INTEGER,
    COALESCE(SUM(
      CASE WHEN m.status = 'finished'
                AND m.updated_at > now() - interval '7 days'
           THEN pr.points_awarded ELSE 0 END
    ), 0)::INTEGER,
    now()
  FROM profiles p
  LEFT JOIN predictions pr ON pr.user_id = p.id
  LEFT JOIN matches m      ON m.id = pr.match_id
  GROUP BY p.id, p.display_name
  ON CONFLICT (user_id) DO UPDATE SET
    display_name        = EXCLUDED.display_name,
    total_points        = EXCLUDED.total_points,
    correct_predictions = EXCLUDED.correct_predictions,
    total_predictions   = EXCLUDED.total_predictions,
    rank                = EXCLUDED.rank,
    weekly_points       = EXCLUDED.weekly_points,
    updated_at          = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

SELECT refresh_leaderboard();
