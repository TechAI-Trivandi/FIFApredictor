-- Update with actual FIFA World Cup 2026 final draw teams
-- WARNING: This wipes existing predictions, matches, and teams data

TRUNCATE predictions, matches, teams RESTART IDENTITY CASCADE;

INSERT INTO teams (name, short_code, flag_url, group_letter) VALUES
-- Group A
('Mexico', 'MEX', '/flags/mex.png', 'A'),
('South Africa', 'RSA', '/flags/rsa.png', 'A'),
('Korea Republic', 'KOR', '/flags/kor.png', 'A'),
('Czechia', 'CZE', '/flags/cze.png', 'A'),
-- Group B
('Canada', 'CAN', '/flags/can.png', 'B'),
('Bosnia and Herzegovina', 'BIH', '/flags/bih.png', 'B'),
('Qatar', 'QAT', '/flags/qat.png', 'B'),
('Switzerland', 'SUI', '/flags/sui.png', 'B'),
-- Group C
('Brazil', 'BRA', '/flags/bra.png', 'C'),
('Morocco', 'MAR', '/flags/mar.png', 'C'),
('Haiti', 'HAI', '/flags/hai.png', 'C'),
('Scotland', 'SCO', '/flags/sco.png', 'C'),
-- Group D
('United States', 'USA', '/flags/usa.png', 'D'),
('Paraguay', 'PAR', '/flags/par.png', 'D'),
('Australia', 'AUS', '/flags/aus.png', 'D'),
('Türkiye', 'TUR', '/flags/tur.png', 'D'),
-- Group E
('Germany', 'GER', '/flags/ger.png', 'E'),
('Curaçao', 'CUW', '/flags/cuw.png', 'E'),
('Ivory Coast', 'CIV', '/flags/civ.png', 'E'),
('Ecuador', 'ECU', '/flags/ecu.png', 'E'),
-- Group F
('Netherlands', 'NED', '/flags/ned.png', 'F'),
('Japan', 'JPN', '/flags/jpn.png', 'F'),
('Sweden', 'SWE', '/flags/swe.png', 'F'),
('Tunisia', 'TUN', '/flags/tun.png', 'F'),
-- Group G
('Belgium', 'BEL', '/flags/bel.png', 'G'),
('Egypt', 'EGY', '/flags/egy.png', 'G'),
('Iran', 'IRN', '/flags/irn.png', 'G'),
('New Zealand', 'NZL', '/flags/nzl.png', 'G'),
-- Group H
('Spain', 'ESP', '/flags/esp.png', 'H'),
('Cape Verde', 'CPV', '/flags/cpv.png', 'H'),
('Saudi Arabia', 'KSA', '/flags/ksa.png', 'H'),
('Uruguay', 'URU', '/flags/uru.png', 'H'),
-- Group I
('France', 'FRA', '/flags/fra.png', 'I'),
('Senegal', 'SEN', '/flags/sen.png', 'I'),
('Iraq', 'IRQ', '/flags/irq.png', 'I'),
('Norway', 'NOR', '/flags/nor.png', 'I'),
-- Group J
('Argentina', 'ARG', '/flags/arg.png', 'J'),
('Algeria', 'ALG', '/flags/alg.png', 'J'),
('Austria', 'AUT', '/flags/aut.png', 'J'),
('Jordan', 'JOR', '/flags/jor.png', 'J'),
-- Group K
('Portugal', 'POR', '/flags/por.png', 'K'),
('DR Congo', 'COD', '/flags/cod.png', 'K'),
('Uzbekistan', 'UZB', '/flags/uzb.png', 'K'),
('Colombia', 'COL', '/flags/col.png', 'K'),
-- Group L
('England', 'ENG', '/flags/eng.png', 'L'),
('Croatia', 'CRO', '/flags/cro.png', 'L'),
('Ghana', 'GHA', '/flags/gha.png', 'L'),
('Panama', 'PAN', '/flags/pan.png', 'L');

-- Re-generate matches
DO $$
DECLARE
  g CHAR(1);
  teams_in_group INTEGER[];
  match_num INTEGER := 1;
BEGIN
  FOR g IN SELECT unnest(ARRAY['A','B','C','D','E','F','G','H','I','J','K','L']) LOOP
    SELECT ARRAY_AGG(id ORDER BY id) INTO teams_in_group
    FROM teams WHERE group_letter = g;

    -- Matchday 1
    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[1], teams_in_group[2], 'group', g, match_num, '2026-06-11 18:00:00+00');
    match_num := match_num + 1;
    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[3], teams_in_group[4], 'group', g, match_num, '2026-06-11 21:00:00+00');
    match_num := match_num + 1;

    -- Matchday 2
    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[1], teams_in_group[3], 'group', g, match_num, '2026-06-15 18:00:00+00');
    match_num := match_num + 1;
    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[2], teams_in_group[4], 'group', g, match_num, '2026-06-15 21:00:00+00');
    match_num := match_num + 1;

    -- Matchday 3
    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[1], teams_in_group[4], 'group', g, match_num, '2026-06-19 18:00:00+00');
    match_num := match_num + 1;
    INSERT INTO matches (home_team_id, away_team_id, stage, group_letter, match_number, kickoff_at)
    VALUES (teams_in_group[2], teams_in_group[3], 'group', g, match_num, '2026-06-19 21:00:00+00');
    match_num := match_num + 1;
  END LOOP;

  -- Knockout matches with NULL teams (TBD)
  FOR i IN 1..16 LOOP
    INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
    VALUES (NULL, NULL, 'round_of_32', match_num,
      '2026-06-25 18:00:00+00'::TIMESTAMPTZ + ((i-1) * INTERVAL '3 hours'));
    match_num := match_num + 1;
  END LOOP;
  FOR i IN 1..8 LOOP
    INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
    VALUES (NULL, NULL, 'round_of_16', match_num,
      '2026-06-29 18:00:00+00'::TIMESTAMPTZ + ((i-1) * INTERVAL '3 hours'));
    match_num := match_num + 1;
  END LOOP;
  FOR i IN 1..4 LOOP
    INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
    VALUES (NULL, NULL, 'quarter_final', match_num,
      '2026-07-03 18:00:00+00'::TIMESTAMPTZ + ((i-1) * INTERVAL '3 hours'));
    match_num := match_num + 1;
  END LOOP;
  FOR i IN 1..2 LOOP
    INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
    VALUES (NULL, NULL, 'semi_final', match_num,
      '2026-07-08 18:00:00+00'::TIMESTAMPTZ + ((i-1) * INTERVAL '3 hours'));
    match_num := match_num + 1;
  END LOOP;
  INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
  VALUES (NULL, NULL, 'third_place', match_num, '2026-07-18 18:00:00+00');
  match_num := match_num + 1;
  INSERT INTO matches (home_team_id, away_team_id, stage, match_number, kickoff_at)
  VALUES (NULL, NULL, 'final', match_num, '2026-07-19 18:00:00+00');
END $$;
