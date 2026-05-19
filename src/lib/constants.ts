export const POINTS_OUTCOME = 2;
export const POINTS_EXACT_SCORE = 5;
export const POINTS_INCORRECT = 0;

export const STAGE_ORDER = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarter-Finals",
  semi_final: "Semi-Finals",
  third_place: "Third Place",
  final: "Final",
};

export const STAGE_MATCH_COUNTS: Record<string, number> = {
  group: 72,
  round_of_32: 16,
  round_of_16: 8,
  quarter_final: 4,
  semi_final: 2,
  third_place: 1,
  final: 1,
};
