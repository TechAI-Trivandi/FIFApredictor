-- Seed: 48 teams for FIFA World Cup 2026
-- Groups A-L (4 teams per group)

INSERT INTO teams (name, short_code, flag_url, group_letter) VALUES
-- Group A
('Morocco', 'MAR', '/flags/mar.png', 'A'),
('Peru', 'PER', '/flags/per.png', 'A'),
('Canada', 'CAN', '/flags/can.png', 'A'),
('Intercontinental Playoff 1', 'IP1', '/flags/ip.png', 'A'),
-- Group B
('Mexico', 'MEX', '/flags/mex.png', 'B'),
('Ecuador', 'ECU', '/flags/ecu.png', 'B'),
('Colombia', 'COL', '/flags/col.png', 'B'),
('Intercontinental Playoff 2', 'IP2', '/flags/ip.png', 'B'),
-- Group C
('United States', 'USA', '/flags/usa.png', 'C'),
('Uruguay', 'URU', '/flags/uru.png', 'C'),
('Panama', 'PAN', '/flags/pan.png', 'C'),
('Bolivia', 'BOL', '/flags/bol.png', 'C'),
-- Group D
('Brazil', 'BRA', '/flags/bra.png', 'D'),
('Italy', 'ITA', '/flags/ita.png', 'D'),
('Albania', 'ALB', '/flags/alb.png', 'D'),
('Intercontinental Playoff 3', 'IP3', '/flags/ip.png', 'D'),
-- Group E
('Argentina', 'ARG', '/flags/arg.png', 'E'),
('Australia', 'AUS', '/flags/aus.png', 'E'),
('Indonesia', 'IDN', '/flags/idn.png', 'E'),
('Intercontinental Playoff 4', 'IP4', '/flags/ip.png', 'E'),
-- Group F
('France', 'FRA', '/flags/fra.png', 'F'),
('South Korea', 'KOR', '/flags/kor.png', 'F'),
('Saudi Arabia', 'KSA', '/flags/ksa.png', 'F'),
('Bahrain', 'BHR', '/flags/bhr.png', 'F'),
-- Group G
('Spain', 'ESP', '/flags/esp.png', 'G'),
('Turkey', 'TUR', '/flags/tur.png', 'G'),
('China PR', 'CHN', '/flags/chn.png', 'G'),
('Intercontinental Playoff 5', 'IP5', '/flags/ip.png', 'G'),
-- Group H
('England', 'ENG', '/flags/eng.png', 'H'),
('Senegal', 'SEN', '/flags/sen.png', 'H'),
('Paraguay', 'PAR', '/flags/par.png', 'H'),
('Slovenia', 'SVN', '/flags/svn.png', 'H'),
-- Group I
('Portugal', 'POR', '/flags/por.png', 'I'),
('Iran', 'IRN', '/flags/irn.png', 'I'),
('Cameroon', 'CMR', '/flags/cmr.png', 'I'),
('Ivory Coast', 'CIV', '/flags/civ.png', 'I'),
-- Group J
('Germany', 'GER', '/flags/ger.png', 'J'),
('Chile', 'CHI', '/flags/chi.png', 'J'),
('Japan', 'JPN', '/flags/jpn.png', 'J'),
('Serbia', 'SRB', '/flags/srb.png', 'J'),
-- Group K
('Netherlands', 'NED', '/flags/ned.png', 'K'),
('Nigeria', 'NGA', '/flags/nga.png', 'K'),
('Tanzania', 'TAN', '/flags/tan.png', 'K'),
('Uganda', 'UGA', '/flags/uga.png', 'K'),
-- Group L
('Belgium', 'BEL', '/flags/bel.png', 'L'),
('Wales', 'WAL', '/flags/wal.png', 'L'),
('Ukraine', 'UKR', '/flags/ukr.png', 'L'),
('Honduras', 'HON', '/flags/hon.png', 'L');

-- Seed: Group Stage Matches (48 matches - 6 per group, 12 groups)
-- Each group has 4 teams playing round-robin (6 matches per group = 72 total group matches)
-- Actually 48 group matches with new format: 3 matchdays, each team plays 3 times

-- Helper: Generate group stage matches
-- Format: 12 groups x 6 matches = 72... wait, FIFA 2026 has 48 teams in 12 groups of 4.
-- Each group: matchday 1 (1v2, 3v4), matchday 2 (1v3, 2v4), matchday 3 (1v4, 2v3)
-- Total: 12 groups × 6 matches = 72 group stage matches
-- Then: 32 teams advance to knockout (top 2 + 8 best 3rd place)
-- Knockout: Round of 32 (16), Round of 16 (8), QF (4), SF (2), 3rd place (1), Final (1) = 32
-- Grand total: 72 + 32 = 104 matches

DO $$
DECLARE
  g CHAR(1);
  teams_in_group INTEGER[];
  match_num INTEGER := 1;
  group_offset INTEGER;
BEGIN
  FOR g IN SELECT unnest(ARRAY['A','B','C','D','E','F','G','H','I','J','K','L']) LOOP
    SELECT ARRAY_AGG(id ORDER BY id) INTO teams_in_group
    FROM teams WHERE group_letter = g;

    -- Matchday 1: Team1 vs Team2, Team3 vs Team4
    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[1], teams_in_group[2], 'group', g, match_num, '2026-06-11 18:00:00+00');
    match_num := match_num + 1;

    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[3], teams_in_group[4], 'group', g, match_num, '2026-06-11 21:00:00+00');
    match_num := match_num + 1;

    -- Matchday 2: Team1 vs Team3, Team2 vs Team4
    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[1], teams_in_group[3], 'group', g, match_num, '2026-06-15 18:00:00+00');
    match_num := match_num + 1;

    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[2], teams_in_group[4], 'group', g, match_num, '2026-06-15 21:00:00+00');
    match_num := match_num + 1;

    -- Matchday 3: Team1 vs Team4, Team2 vs Team3
    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[1], teams_in_group[4], 'group', g, match_num, '2026-06-19 18:00:00+00');
    match_num := match_num + 1;

    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[2], teams_in_group[3], 'group', g, match_num, '2026-06-19 21:00:00+00');
    match_num := match_num + 1;
  END LOOP;

  -- Knockout stage placeholder matches
  -- Round of 32 (16 matches)
  FOR i IN 1..16 LOOP
    INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
    VALUES (
      (SELECT id FROM teams LIMIT 1 OFFSET 0),
      (SELECT id FROM teams LIMIT 1 OFFSET 1),
      'round_of_32', match_num,
      '2026-06-25 18:00:00+00'::TIMESTAMPTZ + ((i-1) * INTERVAL '3 hours')
    );
    match_num := match_num + 1;
  END LOOP;

  -- Round of 16 (8 matches)
  FOR i IN 1..8 LOOP
    INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
    VALUES (
      (SELECT id FROM teams LIMIT 1 OFFSET 0),
      (SELECT id FROM teams LIMIT 1 OFFSET 1),
      'round_of_16', match_num,
      '2026-06-29 18:00:00+00'::TIMESTAMPTZ + ((i-1) * INTERVAL '3 hours')
    );
    match_num := match_num + 1;
  END LOOP;

  -- Quarter-finals (4 matches)
  FOR i IN 1..4 LOOP
    INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
    VALUES (
      (SELECT id FROM teams LIMIT 1 OFFSET 0),
      (SELECT id FROM teams LIMIT 1 OFFSET 1),
      'quarter_final', match_num,
      '2026-07-03 18:00:00+00'::TIMESTAMPTZ + ((i-1) * INTERVAL '3 hours')
    );
    match_num := match_num + 1;
  END LOOP;

  -- Semi-finals (2 matches)
  FOR i IN 1..2 LOOP
    INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
    VALUES (
      (SELECT id FROM teams LIMIT 1 OFFSET 0),
      (SELECT id FROM teams LIMIT 1 OFFSET 1),
      'semi_final', match_num,
      '2026-07-08 18:00:00+00'::TIMESTAMPTZ + ((i-1) * INTERVAL '3 hours')
    );
    match_num := match_num + 1;
  END LOOP;

  -- Third place
  INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
  VALUES (
    (SELECT id FROM teams LIMIT 1 OFFSET 0),
    (SELECT id FROM teams LIMIT 1 OFFSET 1),
    'third_place', match_num,
    '2026-07-18 18:00:00+00'
  );
  match_num := match_num + 1;

  -- Final
  INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
  VALUES (
    (SELECT id FROM teams LIMIT 1 OFFSET 0),
    (SELECT id FROM teams LIMIT 1 OFFSET 1),
    'final', match_num,
    '2026-07-19 18:00:00+00'
  );
END $$;
