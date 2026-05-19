-- Crowd intelligence: aggregate prediction percentages per match
-- Returns a row per (match_id, prediction) with counts + percentage of total picks for that match

CREATE OR REPLACE VIEW match_crowd AS
WITH totals AS (
  SELECT match_id, COUNT(*) AS total_picks
  FROM predictions
  GROUP BY match_id
)
SELECT
  p.match_id,
  p.prediction,
  COUNT(*)::INTEGER AS picks,
  t.total_picks::INTEGER AS total_picks,
  ROUND(100.0 * COUNT(*) / t.total_picks)::INTEGER AS pct
FROM predictions p
JOIN totals t ON t.match_id = p.match_id
GROUP BY p.match_id, p.prediction, t.total_picks;

-- Public read (anyone signed in can see how the office is voting)
GRANT SELECT ON match_crowd TO authenticated, anon;
