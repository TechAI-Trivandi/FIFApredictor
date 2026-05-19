-- Phase 2: Add exact-score predictions, profile avatars, and new scoring rules
-- Scoring: 2 pts for correct outcome only, 5 pts for correct outcome + exact score

-- 1. Add exact-score columns to predictions
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS score_home INTEGER;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS score_away INTEGER;

-- 2. Add avatar to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. Rewrite scoring trigger function
CREATE OR REPLACE FUNCTION score_predictions_for_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.result IS NOT NULL
    AND NEW.home_score IS NOT NULL
    AND NEW.away_score IS NOT NULL
    AND (
      OLD.result IS NULL
      OR OLD.result != NEW.result
      OR OLD.home_score IS DISTINCT FROM NEW.home_score
      OR OLD.away_score IS DISTINCT FROM NEW.away_score
    )
  THEN
    UPDATE predictions
    SET points_awarded = CASE
      -- Wrong outcome: 0 pts
      WHEN prediction != NEW.result THEN 0
      -- Correct outcome AND exact score: 5 pts
      WHEN prediction = NEW.result
        AND score_home IS NOT NULL
        AND score_away IS NOT NULL
        AND score_home = NEW.home_score
        AND score_away = NEW.away_score
        THEN 5
      -- Correct outcome only: 2 pts
      WHEN prediction = NEW.result THEN 2
      ELSE 0
    END
    WHERE match_id = NEW.id;

    PERFORM refresh_leaderboard();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Avatar storage bucket (run this in the Supabase Dashboard if it errors here)
-- Buckets aren't always managed via SQL. If this fails, create the bucket in
-- Storage > New bucket: name="avatars", public=true.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies — anyone can read, owners can upload/update/delete their own
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Recompute existing leaderboard with new scoring (in case results were already entered)
SELECT refresh_leaderboard();
