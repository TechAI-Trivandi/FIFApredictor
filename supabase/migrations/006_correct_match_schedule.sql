-- Fix match schedule to match official FIFA World Cup 2026 fixture list
-- Source: fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
-- All times in UTC (converted from BST shown on FIFA site)
-- WARNING: This wipes existing predictions and matches

TRUNCATE predictions, matches RESTART IDENTITY CASCADE;

-- ============================================================
-- GROUP STAGE — Matchday 1 (72 matches total across 3 matchdays)
-- Team IDs based on insertion order in 003_real_teams.sql:
--   Group A: 1=Mexico, 2=South Africa, 3=Korea Republic, 4=Czechia
--   Group B: 5=Canada, 6=Bosnia and Herzegovina, 7=Qatar, 8=Switzerland
--   Group C: 9=Brazil, 10=Morocco, 11=Haiti, 12=Scotland
--   Group D: 13=USA, 14=Paraguay, 15=Australia, 16=Türkiye
--   Group E: 17=Germany, 18=Curaçao, 19=Ivory Coast, 20=Ecuador
--   Group F: 21=Netherlands, 22=Japan, 23=Sweden, 24=Tunisia
--   Group G: 25=Belgium, 26=Egypt, 27=Iran, 28=New Zealand
--   Group H: 29=Spain, 30=Cape Verde, 31=Saudi Arabia, 32=Uruguay
--   Group I: 33=France, 34=Senegal, 35=Iraq, 36=Norway
--   Group J: 37=Argentina, 38=Algeria, 39=Austria, 40=Jordan
--   Group K: 41=Portugal, 42=DR Congo, 43=Uzbekistan, 44=Colombia
--   Group L: 45=England, 46=Croatia, 47=Ghana, 48=Panama
-- ============================================================

INSERT INTO matches (match_number, home_team_id, away_team_id, stage, group_letter, kickoff_at) VALUES

-- ── Matchday 1 ──────────────────────────────────────────────
-- Thu 11 Jun
(1,  1,  2,  'group', 'A', '2026-06-11 19:00:00+00'),  -- Mexico vs South Africa
-- Fri 12 Jun
(2,  3,  4,  'group', 'A', '2026-06-12 02:00:00+00'),  -- Korea Republic vs Czechia
(3,  5,  6,  'group', 'B', '2026-06-12 19:00:00+00'),  -- Canada vs Bosnia and Herzegovina
-- Sat 13 Jun
(4,  13, 14, 'group', 'D', '2026-06-13 01:00:00+00'),  -- USA vs Paraguay
(5,  7,  8,  'group', 'B', '2026-06-13 19:00:00+00'),  -- Qatar vs Switzerland
(6,  9,  10, 'group', 'C', '2026-06-13 22:00:00+00'),  -- Brazil vs Morocco
-- Sun 14 Jun
(7,  11, 12, 'group', 'C', '2026-06-14 01:00:00+00'),  -- Haiti vs Scotland
(8,  15, 16, 'group', 'D', '2026-06-14 04:00:00+00'),  -- Australia vs Türkiye
(9,  17, 18, 'group', 'E', '2026-06-14 17:00:00+00'),  -- Germany vs Curaçao
(10, 21, 22, 'group', 'F', '2026-06-14 20:00:00+00'),  -- Netherlands vs Japan
(11, 19, 20, 'group', 'E', '2026-06-14 23:00:00+00'),  -- Ivory Coast vs Ecuador
-- Mon 15 Jun
(12, 23, 24, 'group', 'F', '2026-06-15 02:00:00+00'),  -- Sweden vs Tunisia
(13, 29, 30, 'group', 'H', '2026-06-15 16:00:00+00'),  -- Spain vs Cape Verde
(14, 25, 26, 'group', 'G', '2026-06-15 19:00:00+00'),  -- Belgium vs Egypt
(15, 31, 32, 'group', 'H', '2026-06-15 22:00:00+00'),  -- Saudi Arabia vs Uruguay
-- Tue 16 Jun
(16, 27, 28, 'group', 'G', '2026-06-16 01:00:00+00'),  -- Iran vs New Zealand
(17, 33, 34, 'group', 'I', '2026-06-16 19:00:00+00'),  -- France vs Senegal
(18, 35, 36, 'group', 'I', '2026-06-16 22:00:00+00'),  -- Iraq vs Norway
-- Wed 17 Jun
(19, 37, 38, 'group', 'J', '2026-06-17 01:00:00+00'),  -- Argentina vs Algeria
(20, 39, 40, 'group', 'J', '2026-06-17 04:00:00+00'),  -- Austria vs Jordan
(21, 41, 42, 'group', 'K', '2026-06-17 17:00:00+00'),  -- Portugal vs DR Congo
(22, 45, 46, 'group', 'L', '2026-06-17 20:00:00+00'),  -- England vs Croatia
(23, 47, 48, 'group', 'L', '2026-06-17 23:00:00+00'),  -- Ghana vs Panama
-- Thu 18 Jun
(24, 43, 44, 'group', 'K', '2026-06-18 02:00:00+00'),  -- Uzbekistan vs Colombia

-- ── Matchday 2 ──────────────────────────────────────────────
-- Thu 18 Jun
(25, 4,  2,  'group', 'A', '2026-06-18 16:00:00+00'),  -- Czechia vs South Africa
(26, 8,  6,  'group', 'B', '2026-06-18 19:00:00+00'),  -- Switzerland vs Bosnia and Herzegovina
(27, 5,  7,  'group', 'B', '2026-06-18 22:00:00+00'),  -- Canada vs Qatar
-- Fri 19 Jun
(28, 1,  3,  'group', 'A', '2026-06-19 01:00:00+00'),  -- Mexico vs Korea Republic
(29, 13, 15, 'group', 'D', '2026-06-19 19:00:00+00'),  -- USA vs Australia
(30, 12, 10, 'group', 'C', '2026-06-19 22:00:00+00'),  -- Scotland vs Morocco
-- Sat 20 Jun
(31, 9,  11, 'group', 'C', '2026-06-20 00:30:00+00'),  -- Brazil vs Haiti
(32, 16, 14, 'group', 'D', '2026-06-20 03:00:00+00'),  -- Türkiye vs Paraguay
(33, 21, 23, 'group', 'F', '2026-06-20 17:00:00+00'),  -- Netherlands vs Sweden
(34, 17, 19, 'group', 'E', '2026-06-20 20:00:00+00'),  -- Germany vs Ivory Coast
-- Sun 21 Jun
(35, 20, 18, 'group', 'E', '2026-06-21 00:00:00+00'),  -- Ecuador vs Curaçao
(36, 24, 22, 'group', 'F', '2026-06-21 04:00:00+00'),  -- Tunisia vs Japan
(37, 29, 31, 'group', 'H', '2026-06-21 16:00:00+00'),  -- Spain vs Saudi Arabia
(38, 25, 27, 'group', 'G', '2026-06-21 19:00:00+00'),  -- Belgium vs Iran
(39, 32, 30, 'group', 'H', '2026-06-21 22:00:00+00'),  -- Uruguay vs Cape Verde
-- Mon 22 Jun
(40, 28, 26, 'group', 'G', '2026-06-22 01:00:00+00'),  -- New Zealand vs Egypt
(41, 37, 39, 'group', 'J', '2026-06-22 17:00:00+00'),  -- Argentina vs Austria
(42, 33, 35, 'group', 'I', '2026-06-22 21:00:00+00'),  -- France vs Iraq
-- Tue 23 Jun
(43, 36, 34, 'group', 'I', '2026-06-23 00:00:00+00'),  -- Norway vs Senegal
(44, 40, 38, 'group', 'J', '2026-06-23 03:00:00+00'),  -- Jordan vs Algeria
(45, 41, 43, 'group', 'K', '2026-06-23 17:00:00+00'),  -- Portugal vs Uzbekistan
(46, 45, 47, 'group', 'L', '2026-06-23 20:00:00+00'),  -- England vs Ghana
(47, 48, 46, 'group', 'L', '2026-06-23 23:00:00+00'),  -- Panama vs Croatia
-- Wed 24 Jun
(48, 44, 42, 'group', 'K', '2026-06-24 02:00:00+00'),  -- Colombia vs DR Congo

-- ── Matchday 3 ──────────────────────────────────────────────
-- Wed 24 Jun (simultaneous kickoffs per group)
(49, 8,  5,  'group', 'B', '2026-06-24 19:00:00+00'),  -- Switzerland vs Canada
(50, 6,  7,  'group', 'B', '2026-06-24 19:00:00+00'),  -- Bosnia and Herzegovina vs Qatar
(51, 12, 9,  'group', 'C', '2026-06-24 22:00:00+00'),  -- Scotland vs Brazil
(52, 10, 11, 'group', 'C', '2026-06-24 22:00:00+00'),  -- Morocco vs Haiti
-- Thu 25 Jun
(53, 4,  1,  'group', 'A', '2026-06-25 01:00:00+00'),  -- Czechia vs Mexico
(54, 2,  3,  'group', 'A', '2026-06-25 01:00:00+00'),  -- South Africa vs Korea Republic
(55, 18, 19, 'group', 'E', '2026-06-25 20:00:00+00'),  -- Curaçao vs Ivory Coast
(56, 20, 17, 'group', 'E', '2026-06-25 20:00:00+00'),  -- Ecuador vs Germany
(57, 22, 23, 'group', 'F', '2026-06-25 23:00:00+00'),  -- Japan vs Sweden
(58, 24, 21, 'group', 'F', '2026-06-25 23:00:00+00'),  -- Tunisia vs Netherlands
-- Fri 26 Jun
(59, 16, 13, 'group', 'D', '2026-06-26 02:00:00+00'),  -- Türkiye vs USA
(60, 14, 15, 'group', 'D', '2026-06-26 02:00:00+00'),  -- Paraguay vs Australia
(61, 36, 33, 'group', 'I', '2026-06-26 19:00:00+00'),  -- Norway vs France
(62, 34, 35, 'group', 'I', '2026-06-26 19:00:00+00'),  -- Senegal vs Iraq
-- Sat 27 Jun
(63, 30, 31, 'group', 'H', '2026-06-27 00:00:00+00'),  -- Cape Verde vs Saudi Arabia
(64, 32, 29, 'group', 'H', '2026-06-27 00:00:00+00'),  -- Uruguay vs Spain
(65, 26, 27, 'group', 'G', '2026-06-27 03:00:00+00'),  -- Egypt vs Iran
(66, 28, 25, 'group', 'G', '2026-06-27 03:00:00+00'),  -- New Zealand vs Belgium
(67, 48, 45, 'group', 'L', '2026-06-27 21:00:00+00'),  -- Panama vs England
(68, 46, 47, 'group', 'L', '2026-06-27 21:00:00+00'),  -- Croatia vs Ghana
(69, 44, 41, 'group', 'K', '2026-06-27 23:30:00+00'),  -- Colombia vs Portugal
(70, 42, 43, 'group', 'K', '2026-06-27 23:30:00+00'),  -- DR Congo vs Uzbekistan
-- Sun 28 Jun
(71, 38, 39, 'group', 'J', '2026-06-28 02:00:00+00'),  -- Algeria vs Austria
(72, 40, 37, 'group', 'J', '2026-06-28 02:00:00+00'),  -- Jordan vs Argentina

-- ============================================================
-- ROUND OF 32 (16 matches) — bracket positions in comments
-- ============================================================
-- Sun 28 Jun
(73, NULL, NULL, 'round_of_32', NULL, '2026-06-28 19:00:00+00'),  -- 2A vs 2B
-- Mon 29 Jun
(74, NULL, NULL, 'round_of_32', NULL, '2026-06-29 17:00:00+00'),  -- 1C vs 2F
(75, NULL, NULL, 'round_of_32', NULL, '2026-06-29 20:30:00+00'),  -- 1E vs 3ABCDF
-- Tue 30 Jun
(76, NULL, NULL, 'round_of_32', NULL, '2026-06-30 01:00:00+00'),  -- 1F vs 2C
(77, NULL, NULL, 'round_of_32', NULL, '2026-06-30 17:00:00+00'),  -- 2E vs 2I
(78, NULL, NULL, 'round_of_32', NULL, '2026-06-30 21:00:00+00'),  -- 1I vs 3CDFGH
-- Wed 1 Jul
(79, NULL, NULL, 'round_of_32', NULL, '2026-07-01 01:00:00+00'),  -- 1A vs 3CEFHI
(80, NULL, NULL, 'round_of_32', NULL, '2026-07-01 16:00:00+00'),  -- 1L vs 3EHIJK
(81, NULL, NULL, 'round_of_32', NULL, '2026-07-01 20:00:00+00'),  -- 1G vs 3AEHIJ
-- Thu 2 Jul
(82, NULL, NULL, 'round_of_32', NULL, '2026-07-02 00:00:00+00'),  -- 1D vs 3BEFIJ
(83, NULL, NULL, 'round_of_32', NULL, '2026-07-02 19:00:00+00'),  -- 1H vs 2J
-- Fri 3 Jul
(84, NULL, NULL, 'round_of_32', NULL, '2026-07-02 23:00:00+00'),  -- 2K vs 2L
(85, NULL, NULL, 'round_of_32', NULL, '2026-07-03 03:00:00+00'),  -- 1B vs 3EFGIJ
(86, NULL, NULL, 'round_of_32', NULL, '2026-07-03 18:00:00+00'),  -- 2D vs 2G
(87, NULL, NULL, 'round_of_32', NULL, '2026-07-03 22:00:00+00'),  -- 1J vs 2H
-- Sat 4 Jul
(88, NULL, NULL, 'round_of_32', NULL, '2026-07-04 01:30:00+00'),  -- 1K vs 3DEIJL

-- ============================================================
-- ROUND OF 16 (8 matches)
-- ============================================================
-- Sat 4 Jul
(89, NULL, NULL, 'round_of_16', NULL, '2026-07-04 17:00:00+00'),  -- W73 vs W75
(90, NULL, NULL, 'round_of_16', NULL, '2026-07-04 21:00:00+00'),  -- W74 vs W77
-- Sun 5 Jul
(91, NULL, NULL, 'round_of_16', NULL, '2026-07-05 20:00:00+00'),  -- W76 vs W78
-- Mon 6 Jul
(92, NULL, NULL, 'round_of_16', NULL, '2026-07-06 00:00:00+00'),  -- W79 vs W80
(93, NULL, NULL, 'round_of_16', NULL, '2026-07-06 19:00:00+00'),  -- W83 vs W84
-- Tue 7 Jul
(94, NULL, NULL, 'round_of_16', NULL, '2026-07-07 00:00:00+00'),  -- W81 vs W82
(95, NULL, NULL, 'round_of_16', NULL, '2026-07-07 16:00:00+00'),  -- W86 vs W88
(96, NULL, NULL, 'round_of_16', NULL, '2026-07-07 20:00:00+00'),  -- W85 vs W87

-- ============================================================
-- QUARTER-FINALS (4 matches)
-- ============================================================
(97,  NULL, NULL, 'quarter_final', NULL, '2026-07-09 20:00:00+00'),  -- W89 vs W90
(98,  NULL, NULL, 'quarter_final', NULL, '2026-07-10 19:00:00+00'),  -- W93 vs W94
(99,  NULL, NULL, 'quarter_final', NULL, '2026-07-11 21:00:00+00'),  -- W91 vs W92
(100, NULL, NULL, 'quarter_final', NULL, '2026-07-12 01:00:00+00'),  -- W95 vs W96

-- ============================================================
-- SEMI-FINALS (2 matches)
-- ============================================================
(101, NULL, NULL, 'semi_final', NULL, '2026-07-14 19:00:00+00'),  -- W97 vs W98
(102, NULL, NULL, 'semi_final', NULL, '2026-07-15 19:00:00+00'),  -- W99 vs W100

-- ============================================================
-- THIRD PLACE
-- ============================================================
(103, NULL, NULL, 'third_place', NULL, '2026-07-18 21:00:00+00'),  -- RU101 vs RU102

-- ============================================================
-- FINAL
-- ============================================================
(104, NULL, NULL, 'final', NULL, '2026-07-19 19:00:00+00');  -- W101 vs W102
