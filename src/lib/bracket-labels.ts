import type { MatchStage } from "./types";

// R32 pairings based on the FIFA-style bracket layout
// Format: [home_label, away_label] where:
//   "1A" = Winner of Group A, "2B" = Runner-up Group B, "3-" = best 3rd place
// Match numbers 73-88 correspond to R32 matches 1-16
export const R32_PAIRINGS: [string, string][] = [
  ["1E", "3-"],   // R32 #1
  ["1I", "3-"],   // R32 #2
  ["2A", "2B"],   // R32 #3
  ["1F", "2C"],   // R32 #4
  ["2K", "2L"],   // R32 #5
  ["1H", "2J"],   // R32 #6
  ["1D", "3-"],   // R32 #7
  ["1G", "3-"],   // R32 #8
  ["1J", "2H"],   // R32 #9
  ["2D", "2G"],   // R32 #10
  ["1B", "3-"],   // R32 #11
  ["1K", "3-"],   // R32 #12
  ["1C", "2F"],   // R32 #13
  ["2E", "2I"],   // R32 #14
  ["1A", "3-"],   // R32 #15
  ["1L", "3-"],   // R32 #16
];

const STAGE_START: Record<string, number> = {
  group: 1,
  round_of_32: 73,
  round_of_16: 89,
  quarter_final: 97,
  semi_final: 101,
  third_place: 103,
  final: 104,
};

export function getMatchStageNumber(matchNumber: number, stage: MatchStage): number {
  const start = STAGE_START[stage] ?? 1;
  return matchNumber - start + 1;
}

export function getTBDLabel(
  stage: MatchStage,
  matchNumberInStage: number,
  side: "home" | "away"
): string {
  if (stage === "group") return side === "home" ? "Team 1" : "Team 2";

  if (stage === "round_of_32") {
    const pairing = R32_PAIRINGS[matchNumberInStage - 1];
    if (!pairing) return side === "home" ? "TBD" : "TBD";
    return side === "home" ? pairing[0] : pairing[1];
  }

  if (stage === "round_of_16") {
    const idx = (matchNumberInStage - 1) * 2;
    return side === "home" ? `W R32-${idx + 1}` : `W R32-${idx + 2}`;
  }

  if (stage === "quarter_final") {
    const idx = (matchNumberInStage - 1) * 2;
    return side === "home" ? `W R16-${idx + 1}` : `W R16-${idx + 2}`;
  }

  if (stage === "semi_final") {
    const idx = (matchNumberInStage - 1) * 2;
    return side === "home" ? `W QF-${idx + 1}` : `W QF-${idx + 2}`;
  }

  if (stage === "third_place") {
    return side === "home" ? "L SF-1" : "L SF-2";
  }

  if (stage === "final") {
    return side === "home" ? "W SF-1" : "W SF-2";
  }

  return "TBD";
}
