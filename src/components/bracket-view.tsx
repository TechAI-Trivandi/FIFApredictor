"use client";

import Image from "next/image";
import { format } from "date-fns";
import { STAGE_LABELS } from "@/lib/constants";
import { getTBDLabel, getMatchStageNumber } from "@/lib/bracket-labels";
import type { Match, Team } from "@/lib/types";

type EnrichedMatch = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

const LINE_COLOR = "#d1d5db";

export function BracketView({ matches }: { matches: EnrichedMatch[] }) {
  const groupMatches = matches.filter((m) => m.stage === "group");
  const knockoutMatches = matches.filter((m) => m.stage !== "group");

  const groups = Array.from(
    new Set(groupMatches.map((m) => m.group_letter).filter(Boolean))
  ).sort() as string[];

  const r32 = knockoutMatches.filter((m) => m.stage === "round_of_32");
  const r16 = knockoutMatches.filter((m) => m.stage === "round_of_16");
  const qf = knockoutMatches.filter((m) => m.stage === "quarter_final");
  const sf = knockoutMatches.filter((m) => m.stage === "semi_final");
  const final = knockoutMatches.find((m) => m.stage === "final");
  const thirdPlace = knockoutMatches.find((m) => m.stage === "third_place");

  const half = (arr: EnrichedMatch[]) => ({
    left: arr.slice(0, Math.ceil(arr.length / 2)),
    right: arr.slice(Math.ceil(arr.length / 2)),
  });

  const r32H = half(r32);
  const r16H = half(r16);
  const qfH = half(qf);

  return (
    <div className="space-y-12">
      {/* Group stage */}
      <section>
        <div className="eyebrow mb-4">Group Stage</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {groups.map((letter) => (
            <GroupCard
              key={letter}
              letter={letter}
              matches={groupMatches.filter((m) => m.group_letter === letter)}
            />
          ))}
        </div>
      </section>

      {/* Knockout */}
      <section>
        <div className="eyebrow mb-4">Knockout Bracket</div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="flex items-stretch gap-0 min-w-[1280px]">
            {/* Left side */}
            <BracketColumn matches={r32H.left} label={STAGE_LABELS.round_of_32} side="left" round={1} />
            <BracketColumn matches={r16H.left} label={STAGE_LABELS.round_of_16} side="left" round={2} />
            <BracketColumn matches={qfH.left} label={STAGE_LABELS.quarter_final} side="left" round={3} />
            <BracketColumn matches={sf.slice(0, 1)} label={STAGE_LABELS.semi_final} side="left" round={4} isFinalColumn />

            {/* Center: trophy + final */}
            <div className="flex flex-col items-center justify-center px-3 sm:px-5 min-w-[170px]">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
                Final
              </div>
              <div className="relative w-16 h-22 sm:w-20 sm:h-28 mb-3">
                <Image
                  src="/logo-26.png"
                  alt="World Cup Trophy"
                  fill
                  className="object-contain"
                />
              </div>
              {final && <BracketMatchCard match={final} />}
            </div>

            {/* Right side */}
            <BracketColumn matches={sf.slice(1)} label={STAGE_LABELS.semi_final} side="right" round={4} isFinalColumn />
            <BracketColumn matches={qfH.right} label={STAGE_LABELS.quarter_final} side="right" round={3} />
            <BracketColumn matches={r16H.right} label={STAGE_LABELS.round_of_16} side="right" round={2} />
            <BracketColumn matches={r32H.right} label={STAGE_LABELS.round_of_32} side="right" round={1} />
          </div>
        </div>

        {/* Third place */}
        {thirdPlace && (
          <div className="mt-6 max-w-xs mx-auto">
            <div className="eyebrow mb-2 text-center">Third Place Play-off</div>
            <BracketMatchCard match={thirdPlace} />
          </div>
        )}
      </section>
    </div>
  );
}

function GroupCard({
  letter,
  matches,
}: {
  letter: string;
  matches: EnrichedMatch[];
}) {
  const teams = new Map<number, Team>();
  matches.forEach((m) => {
    if (m.home_team) teams.set(m.home_team.id, m.home_team);
    if (m.away_team) teams.set(m.away_team.id, m.away_team);
  });

  return (
    <div className="rounded-xl overflow-hidden bg-white shadow-sm border border-gray-200">
      <div className="px-3 py-2.5 text-center border-b border-gray-200">
        <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-brand-navy">
          Group {letter}
        </span>
      </div>
      <div className="px-3 py-3 space-y-2.5">
        {Array.from(teams.values()).map((team) => (
          <div key={team.id} className="flex items-center gap-2.5" title={team.name}>
            <div className="relative w-5 h-5 rounded-sm overflow-hidden border border-gray-200 flex-shrink-0 shadow-sm">
              <Image src={team.flag_url} alt={team.name} fill className="object-cover" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-tight text-brand-navy truncate">
              {team.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders a column with its matches grouped into pairs (with connector lines)
 * unless `isFinalColumn` (then just renders one match).
 */
function BracketColumn({
  matches,
  label,
  side,
  round,
  isFinalColumn = false,
}: {
  matches: EnrichedMatch[];
  label: string;
  side: "left" | "right";
  round: number;
  isFinalColumn?: boolean;
}) {
  if (matches.length === 0) return null;

  // Pair adjacent matches
  const pairs: EnrichedMatch[][] = [];
  for (let i = 0; i < matches.length; i += 2) {
    pairs.push(matches.slice(i, i + 2));
  }

  return (
    <div className="flex flex-col flex-1 min-w-[150px] px-1">
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 text-center mb-3">
        {label}
      </div>
      <div className="flex flex-col flex-1 justify-around gap-3">
        {pairs.map((pair, i) => (
          <BracketPair
            key={i}
            matches={pair}
            side={side}
            round={round}
            isFinalColumn={isFinalColumn}
          />
        ))}
      </div>
    </div>
  );
}

function BracketPair({
  matches,
  side,
  round,
  isFinalColumn,
}: {
  matches: EnrichedMatch[];
  side: "left" | "right";
  round: number;
  isFinalColumn: boolean;
}) {
  const isPair = matches.length === 2;
  const drawConnectors = isPair && !isFinalColumn;
  // Visual settings
  const connectorWidth = 14;
  const stubWidth = 14;

  // Use absolute positioning for connector lines
  const connectorSide = side === "left" ? "right" : "left";

  return (
    <div className="relative flex flex-col gap-3">
      {matches.map((m) => (
        <BracketMatchCard key={m.id} match={m} />
      ))}

      {drawConnectors && (
        <>
          {/* Stub from top match midpoint */}
          <div
            className="absolute h-px"
            style={{
              backgroundColor: LINE_COLOR,
              top: "calc(25% + 0px)",
              [connectorSide]: `-${stubWidth}px`,
              width: `${stubWidth}px`,
            }}
          />
          {/* Stub from bottom match midpoint */}
          <div
            className="absolute h-px"
            style={{
              backgroundColor: LINE_COLOR,
              bottom: "calc(25% + 0px)",
              [connectorSide]: `-${stubWidth}px`,
              width: `${stubWidth}px`,
            }}
          />
          {/* Vertical line connecting the two stubs */}
          <div
            className="absolute w-px"
            style={{
              backgroundColor: LINE_COLOR,
              top: "25%",
              bottom: "25%",
              [connectorSide]: `-${stubWidth}px`,
            }}
          />
          {/* Output stub from middle of vertical → next round */}
          <div
            className="absolute h-px"
            style={{
              backgroundColor: LINE_COLOR,
              top: "calc(50% - 0.5px)",
              [connectorSide]: `-${stubWidth + connectorWidth}px`,
              width: `${connectorWidth}px`,
            }}
          />
        </>
      )}
    </div>
  );
}

function BracketMatchCard({ match }: { match: EnrichedMatch }) {
  const stageNum = getMatchStageNumber(match.match_number, match.stage);
  const homeFallback = getTBDLabel(match.stage, stageNum, "home");
  const awayFallback = getTBDLabel(match.stage, stageNum, "away");
  const isFinished = match.status === "finished";

  const teamRow = (team: Team | null, fallback: string, score: number | null) => (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5"
      title={team?.name ?? fallback}
    >
      <div className="w-4 h-4 rounded-sm overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-50">
        {team && (
          <Image src={team.flag_url} alt={team.name} width={16} height={16} className="object-cover w-full h-full" />
        )}
      </div>
      <span className={`text-xs truncate flex-1 ${team ? "font-semibold text-gray-900" : "text-gray-500"}`}>
        {team ? team.short_code : fallback}
      </span>
      {isFinished && (
        <span className="text-xs font-semibold font-mono text-gray-900">
          {score}
        </span>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-md overflow-hidden border border-gray-300 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {teamRow(match.home_team ?? null, homeFallback, match.home_score)}
      <div className="border-t border-gray-100" />
      {teamRow(match.away_team ?? null, awayFallback, match.away_score)}
      {!isFinished && (
        <div className="bg-gray-50 px-2 py-1 border-t border-gray-100 text-center">
          {match.status === "live" ? (
            <span className="text-[9px] uppercase tracking-wider font-bold text-[#B8252A]">Live</span>
          ) : (
            <div className="text-[10px] text-gray-500">
              {format(new Date(match.kickoff_at), "MMM d")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
