-- Allow nullable team IDs for knockout matches (TBD teams)
ALTER TABLE matches ALTER COLUMN home_team_id DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team_id DROP NOT NULL;

-- Add prediction lock per stage
CREATE TABLE stage_locks (
  stage TEXT PRIMARY KEY CHECK (stage IN (
    'group', 'round_of_32', 'round_of_16',
    'quarter_final', 'semi_final', 'third_place', 'final'
  )),
  locked BOOLEAN NOT NULL DEFAULT false,
  predictions_open BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed stage locks
INSERT INTO stage_locks (stage, locked, predictions_open) VALUES
  ('group', false, true),
  ('round_of_32', true, false),
  ('round_of_16', true, false),
  ('quarter_final', true, false),
  ('semi_final', true, false),
  ('third_place', true, false),
  ('final', true, false);

-- Enable RLS
ALTER TABLE stage_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read stage_locks" ON stage_locks FOR SELECT USING (true);

-- Update prediction RLS policies to use stage-based locking
DROP POLICY IF EXISTS "Users can insert own predictions before lock" ON predictions;
DROP POLICY IF EXISTS "Users can update own predictions before lock" ON predictions;

CREATE POLICY "Users can insert own predictions when stage open" ON predictions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN stage_locks sl ON sl.stage = m.stage
      WHERE m.id = match_id
      AND sl.predictions_open = true
      AND sl.locked = false
    )
  );

CREATE POLICY "Users can update own predictions when stage open" ON predictions
  FOR UPDATE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN stage_locks sl ON sl.stage = m.stage
      WHERE m.id = match_id
      AND sl.predictions_open = true
      AND sl.locked = false
    )
  );

-- Set knockout matches to have NULL teams (they're TBD)
UPDATE matches SET home_team_id = NULL, away_team_id = NULL
WHERE stage != 'group';
