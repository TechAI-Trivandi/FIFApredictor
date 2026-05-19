-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams table
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  short_code TEXT NOT NULL UNIQUE,
  flag_url TEXT NOT NULL,
  group_letter CHAR(1) NOT NULL,
  api_team_id INTEGER
);

-- Matches table
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  stage TEXT NOT NULL CHECK (stage IN (
    'group', 'round_of_32', 'round_of_16',
    'quarter_final', 'semi_final', 'third_place', 'final'
  )),
  group_letter CHAR(1),
  match_number INTEGER NOT NULL,
  kickoff_at TIMESTAMPTZ NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  result TEXT CHECK (result IN ('home', 'draw', 'away')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished')),
  api_fixture_id INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Predictions table
CREATE TABLE predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  prediction TEXT NOT NULL CHECK (prediction IN ('home', 'draw', 'away')),
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

-- Leaderboard table (pre-computed)
CREATE TABLE leaderboard (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  correct_predictions INTEGER NOT NULL DEFAULT 0,
  total_predictions INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invitations table
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function: refresh leaderboard
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS VOID AS $$
BEGIN
  TRUNCATE leaderboard;
  INSERT INTO leaderboard (user_id, display_name, total_points, correct_predictions, total_predictions, rank, updated_at)
  SELECT
    p.id,
    p.display_name,
    COALESCE(SUM(pr.points_awarded), 0)::INTEGER AS total_points,
    COUNT(*) FILTER (WHERE pr.points_awarded > 0)::INTEGER AS correct_predictions,
    COUNT(pr.id)::INTEGER AS total_predictions,
    RANK() OVER (ORDER BY COALESCE(SUM(pr.points_awarded), 0) DESC)::INTEGER AS rank,
    now()
  FROM profiles p
  LEFT JOIN predictions pr ON pr.user_id = p.id
  GROUP BY p.id, p.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function: score predictions when match result is set
CREATE OR REPLACE FUNCTION score_predictions_for_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.result IS NOT NULL AND (OLD.result IS NULL OR OLD.result != NEW.result) THEN
    UPDATE predictions
    SET points_awarded = CASE
      WHEN prediction = NEW.result THEN 3
      ELSE 0
    END
    WHERE match_id = NEW.id;

    PERFORM refresh_leaderboard();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to matches
CREATE TRIGGER on_match_result_update
  AFTER UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION score_predictions_for_match();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: profiles
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies: teams
CREATE POLICY "Anyone can read teams" ON teams FOR SELECT USING (true);

-- RLS Policies: matches
CREATE POLICY "Anyone can read matches" ON matches FOR SELECT USING (true);

-- RLS Policies: predictions
CREATE POLICY "Anyone can read predictions" ON predictions FOR SELECT USING (true);
CREATE POLICY "Users can insert own predictions before lock" ON predictions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND now() < '2026-06-11T00:00:00Z'::TIMESTAMPTZ
  );
CREATE POLICY "Users can update own predictions before lock" ON predictions
  FOR UPDATE USING (
    auth.uid() = user_id
    AND now() < '2026-06-11T00:00:00Z'::TIMESTAMPTZ
  );

-- RLS Policies: leaderboard
CREATE POLICY "Anyone can read leaderboard" ON leaderboard FOR SELECT USING (true);

-- RLS Policies: invitations (admin only via service role)
CREATE POLICY "Only admins can read invitations" ON invitations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Indexes
CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_match ON predictions(match_id);
CREATE INDEX idx_matches_stage ON matches(stage);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_leaderboard_rank ON leaderboard(rank);
