-- CRITICAL FIX: refresh_leaderboard() was failing on every call.
--
-- Supabase runs with `sql_safe_updates = on`, which rejects any UPDATE or
-- DELETE without a WHERE clause (Postgres error 21000). Migration 009's
-- Step 1 snapshot —
--     UPDATE leaderboard SET previous_rank = rank;
-- — has no WHERE clause, so the whole function aborted before doing anything.
--
-- Result: the leaderboard never refreshed (stale rows, no points ever shown)
-- since 009 was applied. Adding `WHERE true` satisfies the safety check while
-- still updating every row.

CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS VOID AS $$
BEGIN
  -- Step 1: snapshot current rank → previous_rank before we recompute
  UPDATE leaderboard SET previous_rank = rank WHERE true;

  -- Step 2: remove rows for deleted users
  DELETE FROM leaderboard
  WHERE user_id NOT IN (SELECT id FROM profiles);

  -- Step 3: upsert fresh totals (previous_rank is NOT overwritten)
  INSERT INTO leaderboard
    (user_id, display_name, total_points, correct_predictions,
     total_predictions, rank, weekly_points, updated_at)
  SELECT
    p.id,
    p.display_name,
    COALESCE(SUM(pr.points_awarded), 0)::INTEGER            AS total_points,
    COUNT(*) FILTER (WHERE pr.points_awarded > 0)::INTEGER   AS correct_predictions,
    COUNT(pr.id)::INTEGER                                    AS total_predictions,
    RANK() OVER (
      ORDER BY COALESCE(SUM(pr.points_awarded), 0) DESC
    )::INTEGER                                               AS rank,
    COALESCE(SUM(
      CASE WHEN m.status = 'finished'
                AND m.updated_at > now() - interval '7 days'
           THEN pr.points_awarded ELSE 0 END
    ), 0)::INTEGER                                           AS weekly_points,
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
    -- previous_rank intentionally NOT updated — retains the snapshot from Step 1
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Run once now to populate the leaderboard with every current user.
SELECT refresh_leaderboard();
