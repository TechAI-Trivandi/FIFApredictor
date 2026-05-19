export type UserRole = "user" | "admin";
export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";
export type MatchStatus = "scheduled" | "live" | "finished";
export type PredictionChoice = "home" | "draw" | "away";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  short_code: string;
  flag_url: string;
  group_letter: string;
  api_team_id: number | null;
}

export interface Match {
  id: number;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team?: Team | null;
  away_team?: Team | null;
  stage: MatchStage;
  group_letter: string | null;
  match_number: number;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  result: PredictionChoice | null;
  status: MatchStatus;
  api_fixture_id: number | null;
  updated_at: string;
}

export interface StageLock {
  stage: MatchStage;
  locked: boolean;
  predictions_open: boolean;
  updated_at: string;
}

export interface Prediction {
  id: number;
  user_id: string;
  match_id: number;
  prediction: PredictionChoice;
  score_home: number | null;
  score_away: number | null;
  points_awarded: number;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  total_points: number;
  correct_predictions: number;
  total_predictions: number;
  rank: number;
  previous_rank: number | null;
  weekly_points: number;
  updated_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  invited_by: string | null;
  status: "pending" | "accepted";
  created_at: string;
}
