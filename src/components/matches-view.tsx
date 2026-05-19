"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { format, isSameMonth, startOfMonth, getDate, getDay } from "date-fns";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { getTBDLabel, getMatchStageNumber } from "@/lib/bracket-labels";
import type { Match, Team } from "@/lib/types";

type EnrichedMatch = Match & { home_team: Team | null; away_team: Team | null };

const STAGE_PILL_LABELS: Record<string, string> = {
  group: "Group",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarters",
  semi_final: "Semis",
  third_place: "Third place",
  final: "Final",
};

export function MatchesView({ matches, predictedMatchIds = [] }: { matches: EnrichedMatch[]; predictedMatchIds?: number[] }) {
  const predictedSet = useMemo(() => new Set(predictedMatchIds), [predictedMatchIds]);
  const [view, setView] = useState<"List" | "Bracket" | "Calendar">("List");
  const [scope, setScope] = useState<"All" | "My picks">("All");
  const [stage, setStage] = useState<string>("group");

  const stages = STAGE_ORDER.filter((s) => matches.some((m) => m.stage === s));

  const liveCount = matches.filter((m) => m.status === "live").length;
  const playedCount = matches.filter((m) => m.status === "finished").length;
  const upcomingCount = matches.filter((m) => m.status === "scheduled").length;

  return (
    <div>
      {/* Page head */}
      <header className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end pb-6 border-b border-ink">
        <div>
          <div className="flex items-center gap-3.5 mb-4">
            <span className="mono text-[11px] tracking-[0.12em] text-muted-warm uppercase">
              MTC · {matches.length} MATCHES
            </span>
            <span className="flex-1 h-px bg-line" />
            <span className="mono text-[11px] tracking-[0.12em] text-muted-warm uppercase">
              12 GROUPS · 7 STAGES
            </span>
          </div>
          <h1 className="display-heading text-[64px] sm:text-[88px] leading-[0.88] tracking-[-0.045em] text-ink">
            All the<br />
            <i>matches.</i>
          </h1>
        </div>
        <div className="lg:text-right pb-3">
          <div className="flex gap-3 lg:justify-end flex-wrap">
            <Segment
              options={["List", "Bracket", "Calendar"]}
              value={view}
              onChange={(v) => setView(v as typeof view)}
            />
            <Segment
              options={["All", "My picks"]}
              value={scope}
              onChange={(v) => setScope(v as typeof scope)}
            />
          </div>
          <div className="mono text-[10px] uppercase tracking-[0.16em] text-muted-warm mt-3.5">
            {liveCount} LIVE · {playedCount} PLAYED · {upcomingCount} UPCOMING
          </div>
        </div>
      </header>

      {/* Stage strip — only for List view */}
      {view === "List" && (
        <div className="flex gap-1 flex-wrap pt-5 pb-1 border-b border-line">
          {stages.map((s) => {
            const count = matches.filter((m) => m.stage === s).length;
            const isActive = stage === s;
            return (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`inline-flex items-center gap-2 border border-ink px-3.5 py-2 mono text-[10px] font-bold tracking-[0.16em] uppercase transition-colors ${
                  isActive ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-paper-deep"
                }`}
              >
                {STAGE_PILL_LABELS[s] ?? s}
                <span
                  className={`mono text-[9px] px-1 py-px ${
                    isActive ? "bg-white/18 text-white/85" : "bg-paper-deep text-ink"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {view === "List" && stage === "group" && (
        <GroupListView matches={matches} scope={scope} predictedSet={predictedSet} />
      )}
      {view === "List" && stage !== "group" && (
        <KnockoutListView matches={matches.filter((m) => m.stage === stage)} scope={scope} stage={stage} predictedSet={predictedSet} />
      )}
      {view === "Bracket" && <BracketGridView matches={matches} />}
      {view === "Calendar" && <CalendarView matches={matches} />}
    </div>
  );
}

function Segment({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex border border-ink">
      {options.map((opt, i) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-4 py-2.5 mono text-[10px] font-bold tracking-[0.18em] uppercase transition-colors ${
              i < options.length - 1 ? "border-r border-line" : ""
            } ${active ? "bg-ink text-paper" : "bg-transparent text-muted-warm hover:bg-paper-deep hover:text-ink"}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function GroupListView({ matches, scope, predictedSet }: { matches: EnrichedMatch[]; scope: "All" | "My picks"; predictedSet: Set<number> }) {
  const groups = Array.from(
    new Set(
      matches.filter((m) => m.stage === "group" && m.group_letter).map((m) => m.group_letter as string)
    )
  ).sort();

  const visibleGroups = scope === "My picks"
    ? groups.filter((letter) => matches.some((m) => m.stage === "group" && m.group_letter === letter && predictedSet.has(m.id)))
    : groups;

  if (visibleGroups.length === 0) {
    return (
      <div className="mt-12 text-center serif italic text-muted-warm text-[20px]">
        No predictions yet for the group stage.
      </div>
    );
  }

  return (
    <div className="space-y-7 pt-7">
      {visibleGroups.map((letter) => {
        const groupMatches = matches.filter((m) => m.stage === "group" && m.group_letter === letter);
        return <GroupBlock key={letter} letter={letter} matches={groupMatches} scope={scope} predictedSet={predictedSet} />;
      })}
    </div>
  );
}

function GroupBlock({
  letter,
  matches,
  scope,
  predictedSet,
}: {
  letter: string;
  matches: EnrichedMatch[];
  scope: "All" | "My picks";
  predictedSet: Set<number>;
}) {
  // Collect teams + their stats from finished matches
  const teamStats = new Map<
    number,
    { team: Team; played: number; gd: number; pts: number }
  >();
  matches.forEach((m) => {
    if (m.home_team) {
      teamStats.set(m.home_team.id, teamStats.get(m.home_team.id) ?? { team: m.home_team, played: 0, gd: 0, pts: 0 });
    }
    if (m.away_team) {
      teamStats.set(m.away_team.id, teamStats.get(m.away_team.id) ?? { team: m.away_team, played: 0, gd: 0, pts: 0 });
    }
  });

  matches.forEach((m) => {
    if (m.status !== "finished" || m.home_team_id == null || m.away_team_id == null) return;
    const home = teamStats.get(m.home_team_id);
    const away = teamStats.get(m.away_team_id);
    if (!home || !away || m.home_score == null || m.away_score == null) return;
    home.played++;
    away.played++;
    home.gd += m.home_score - m.away_score;
    away.gd += m.away_score - m.home_score;
    if (m.home_score > m.away_score) home.pts += 3;
    else if (m.away_score > m.home_score) away.pts += 3;
    else {
      home.pts += 1;
      away.pts += 1;
    }
  });

  const tableRows = Array.from(teamStats.values()).sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || a.team.name.localeCompare(b.team.name)
  );

  const playedCount = matches.filter((m) => m.status === "finished").length;
  const visibleMatches = scope === "My picks" ? matches.filter((m) => predictedSet.has(m.id)) : matches;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start min-w-0">
      {/* Group standings */}
      <div className="border border-ink">
        <div className="px-4.5 py-3 border-b border-ink bg-ink text-paper flex justify-between items-baseline">
          <div className="serif italic font-normal text-[24px] tracking-[-0.01em]">
            Group <i className="text-paper">{letter}</i>
          </div>
          <div className="mono text-[9px] uppercase tracking-[0.18em] text-paper/55">
            {playedCount}/{matches.length} played
          </div>
        </div>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr>
              <th className="mono text-[9px] font-bold tracking-[0.18em] uppercase text-muted-warm py-2.5 pl-4 text-left border-b border-line">#</th>
              <th className="mono text-[9px] font-bold tracking-[0.18em] uppercase text-muted-warm py-2.5 text-left border-b border-line">Team</th>
              <th className="mono text-[9px] font-bold tracking-[0.18em] uppercase text-muted-warm py-2.5 text-right border-b border-line">P</th>
              <th className="mono text-[9px] font-bold tracking-[0.18em] uppercase text-muted-warm py-2.5 text-right border-b border-line">GD</th>
              <th className="mono text-[9px] font-bold tracking-[0.18em] uppercase text-muted-warm py-2.5 pr-4 text-right border-b border-line">PTS</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => {
              const qualifies = idx < 2;
              return (
                <tr key={row.team.id}>
                  <td className="py-2.5 pl-4 border-b border-line last:border-b-0 mono text-[12px] text-muted-warm">
                    {qualifies && (
                      <span className="inline-block w-[3px] h-[18px] bg-blue-brand mr-1.5 align-[-4px]" />
                    )}
                    {idx + 1}
                  </td>
                  <td className="py-2.5 border-b border-line">
                    <span className="flex items-center gap-2.5 serif font-semibold text-[14px] tracking-[-0.01em]">
                      <span className="w-[22px] h-[22px] rounded-[4px] overflow-hidden border border-paper">
                        <Image src={row.team.flag_url} alt={row.team.name} width={22} height={22} className="object-cover w-full h-full" />
                      </span>
                      {row.team.name}
                    </span>
                  </td>
                  <td className="py-2.5 border-b border-line text-right mono text-[12px]">{row.played}</td>
                  <td className="py-2.5 border-b border-line text-right mono text-[12px]">
                    {row.gd > 0 ? `+${row.gd}` : row.gd}
                  </td>
                  <td className="py-2.5 pr-4 border-b border-line text-right serif font-semibold text-[18px] num">
                    {row.pts}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Match list */}
      <div className="min-w-0">
        {visibleMatches.map((m) => (
          <MatchLine key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

function KnockoutListView({
  matches,
  scope,
  stage,
  predictedSet,
}: {
  matches: EnrichedMatch[];
  scope: "All" | "My picks";
  stage: string;
  predictedSet: Set<number>;
}) {
  const visible = scope === "My picks" ? matches.filter((m) => predictedSet.has(m.id)) : matches;

  if (visible.length === 0) {
    return (
      <div className="mt-12 text-center serif italic text-muted-warm text-[20px]">
        {scope === "My picks" ? "No predictions yet for this stage." : "No matches scheduled in this stage yet."}
      </div>
    );
  }

  return (
    <div className="pt-7">
      <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="serif font-semibold text-[28px] tracking-[-0.02em]">
          {STAGE_LABELS[stage]}
        </h2>
        <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted-warm">
          {visible.length} {visible.length === 1 ? "match" : "matches"}
        </span>
      </div>
      <div>
        {visible.map((m) => (
          <MatchLine key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

function MatchLine({ match }: { match: EnrichedMatch }) {
  const stageNum = getMatchStageNumber(match.match_number, match.stage);
  const homeFallback = getTBDLabel(match.stage, stageNum, "home");
  const awayFallback = getTBDLabel(match.stage, stageNum, "away");
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isUpcoming = match.status === "scheduled";

  return (
    <div
      className={`grid grid-cols-[90px_minmax(0,1fr)_90px_minmax(0,1fr)_90px] gap-3 items-center py-3.5 px-1.5 border-b border-line transition-colors min-w-0 ${
        isLive ? "bg-blue-brand/[0.06] border-l-[3px] border-l-blue-brand pl-3.5" : "hover:bg-white/50"
      }`}
    >
      <div className="mono text-[10px] uppercase tracking-[0.06em] text-muted-warm">
        <b className="block serif italic font-semibold text-[16px] tracking-[-0.01em] text-ink mb-0.5 normal-case">
          {format(new Date(match.kickoff_at), "EEE d MMM")}
        </b>
        {format(new Date(match.kickoff_at), "HH:mm")}
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <Flag team={match.home_team} />
        <div className="min-w-0 overflow-hidden">
          <div className="serif font-semibold text-[16px] tracking-[-0.01em] truncate">
            {match.home_team?.name ?? homeFallback}
          </div>
          <div className="mono text-[10px] tracking-[0.06em] text-muted-warm">
            {match.home_team?.short_code ?? ""}
          </div>
        </div>
      </div>

      <div
        className={`text-center serif font-semibold text-[26px] tracking-[-0.025em] num ${
          isLive ? "text-blue-brand" : ""
        } ${isUpcoming ? "mono text-[11px] font-medium text-muted-warm tracking-[0.18em] uppercase" : ""}`}
      >
        {isUpcoming ? "vs" : `${match.home_score ?? 0}–${match.away_score ?? 0}`}
      </div>

      <div className="flex items-center gap-3 flex-row-reverse text-right min-w-0">
        <Flag team={match.away_team} />
        <div className="min-w-0 overflow-hidden">
          <div className="serif font-semibold text-[16px] tracking-[-0.01em] truncate">
            {match.away_team?.name ?? awayFallback}
          </div>
          <div className="mono text-[10px] tracking-[0.06em] text-muted-warm">
            {match.away_team?.short_code ?? ""}
          </div>
        </div>
      </div>

      <div className="text-right">
        {isLive && (
          <span className="inline-block px-2 py-1 mono text-[9px] font-bold tracking-[0.12em] uppercase bg-blue-brand text-white">
            ● LIVE
          </span>
        )}
        {isFinished && (
          <span className="inline-block px-2 py-1 mono text-[9px] font-bold tracking-[0.12em] uppercase bg-paper-deep text-ink border border-line">
            FT
          </span>
        )}
        {isUpcoming && (
          <span className="inline-block px-2 py-1 mono text-[9px] font-bold tracking-[0.12em] uppercase border border-dashed border-line text-muted-warm">
            UPCOMING
          </span>
        )}
      </div>
    </div>
  );
}

function Flag({ team }: { team: Team | null }) {
  if (!team) {
    return (
      <div className="w-9 h-9 rounded-full bg-paper-deep border border-line shrink-0" />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden border border-paper shadow-[0_0_0_1px_var(--line)] shrink-0">
      <Image src={team.flag_url} alt={team.name} width={36} height={36} className="object-cover w-full h-full" />
    </div>
  );
}

/* ── BRACKET VIEW ── */

function BracketGridView({ matches }: { matches: EnrichedMatch[] }) {
  const r32 = matches.filter((m) => m.stage === "round_of_32");
  const r16 = matches.filter((m) => m.stage === "round_of_16");
  const qf = matches.filter((m) => m.stage === "quarter_final");
  const sf = matches.filter((m) => m.stage === "semi_final");
  const final = matches.find((m) => m.stage === "final");
  const third = matches.find((m) => m.stage === "third_place");

  const half = (arr: EnrichedMatch[]) => ({
    left: arr.slice(0, Math.ceil(arr.length / 2)),
    right: arr.slice(Math.ceil(arr.length / 2)),
  });

  const r32H = half(r32);
  const r16H = half(r16);
  const qfH = half(qf);

  return (
    <div className="mt-7 border border-ink bg-paper p-7">
      <h3 className="serif font-semibold text-[28px] tracking-[-0.02em]">
        Knockout <i className="font-normal text-blue-brand">bracket.</i>
      </h3>
      <p className="serif italic text-[15px] text-muted-warm mt-2 max-w-[480px] leading-relaxed">
        Sixteen teams, five rounds, one trophy. Teams populate as the group stage finalises &mdash; your picks carry through.
      </p>

      <div className="overflow-x-auto mt-7 -mx-7 px-7 pb-2">
        <div className="grid grid-cols-9 gap-4 min-w-[1100px]">
          <BracketCol matches={r32H.left} label="R32" />
          <BracketCol matches={r16H.left} label="R16" />
          <BracketCol matches={qfH.left} label="QF" />
          <BracketCol matches={sf.slice(0, 1)} label="SF" />
          <div className="flex flex-col items-center justify-center px-2">
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-warm mb-3">Final</div>
            <div className="relative w-[80px] h-[110px] mb-3">
              <Image src="/logo-26.png" alt="Trophy" fill className="object-contain" />
            </div>
            {final && (
              <BracketCard match={final} highlight />
            )}
          </div>
          <BracketCol matches={sf.slice(1)} label="SF" />
          <BracketCol matches={qfH.right} label="QF" />
          <BracketCol matches={r16H.right} label="R16" />
          <BracketCol matches={r32H.right} label="R32" />
        </div>
      </div>

      {third && (
        <div className="mt-7 max-w-xs mx-auto">
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-warm mb-2 text-center">
            Third Place Play-off
          </div>
          <BracketCard match={third} />
        </div>
      )}
    </div>
  );
}

function BracketCol({ matches, label }: { matches: EnrichedMatch[]; label: string }) {
  if (matches.length === 0) return null;
  return (
    <div className="flex flex-col">
      <div className="mono text-[9px] uppercase tracking-[0.18em] text-muted-warm pb-2.5 border-b border-line mb-2 text-center">
        {label}
      </div>
      <div className="flex flex-col flex-1 justify-around gap-3">
        {matches.map((m) => (
          <BracketCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

function BracketCard({ match, highlight }: { match: EnrichedMatch; highlight?: boolean }) {
  const stageNum = getMatchStageNumber(match.match_number, match.stage);
  const homeFallback = getTBDLabel(match.stage, stageNum, "home");
  const awayFallback = getTBDLabel(match.stage, stageNum, "away");
  const isFinished = match.status === "finished";

  const row = (team: Team | null, fallback: string, score: number | null) => (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5">
      <div className="w-4 h-4 rounded-sm overflow-hidden bg-paper-deep shrink-0">
        {team && (
          <Image src={team.flag_url} alt={team.name} width={16} height={16} className="object-cover w-full h-full" />
        )}
      </div>
      <span
        className={`text-[12px] truncate flex-1 ${
          team ? "serif font-semibold tracking-[-0.01em]" : "serif italic font-normal text-muted-warm"
        }`}
      >
        {team ? team.short_code : fallback}
      </span>
      {isFinished && score != null && (
        <span className="mono text-[12px] font-semibold">{score}</span>
      )}
    </div>
  );

  return (
    <div
      className={`border ${
        highlight ? "border-ink bg-ink text-paper" : "border-ink bg-paper-deep"
      } min-h-[34px]`}
    >
      {highlight ? (
        <div className="text-center py-3 serif italic font-normal text-[18px] tracking-[-0.01em]">
          {match.home_team?.short_code ?? "TBD"} vs {match.away_team?.short_code ?? "TBD"}
        </div>
      ) : (
        <>
          {row(match.home_team ?? null, homeFallback, match.home_score)}
          <div className="border-t border-line" />
          {row(match.away_team ?? null, awayFallback, match.away_score)}
        </>
      )}
    </div>
  );
}

/* ── CALENDAR VIEW ── */

function CalendarView({ matches }: { matches: EnrichedMatch[] }) {
  // Group by month; show only months with matches
  const months = useMemo(() => {
    const map = new Map<string, EnrichedMatch[]>();
    for (const m of matches) {
      const monthKey = format(new Date(m.kickoff_at), "yyyy-MM");
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(m);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, ms]) => ({
        key,
        date: new Date(`${key}-01`),
        matches: ms,
      }));
  }, [matches]);

  return (
    <div className="mt-7 border border-ink bg-paper p-7">
      <h3 className="serif font-semibold text-[28px] tracking-[-0.02em]">
        Calendar <i className="font-normal text-blue-brand">view.</i>
      </h3>
      <p className="serif italic text-[15px] text-muted-warm mt-2 max-w-[480px] leading-relaxed">
        Match density at a glance. Each cell shows how many matches happen that day, color-coded by knockout vs group stage.
      </p>

      <div className="space-y-9 mt-7">
        {months.map((m) => (
          <CalendarMonth key={m.key} monthDate={m.date} matches={m.matches} />
        ))}
      </div>
    </div>
  );
}

function CalendarMonth({ monthDate, matches }: { monthDate: Date; matches: EnrichedMatch[] }) {
  const start = startOfMonth(monthDate);
  const startDay = getDay(start); // 0=Sun ... 6=Sat
  const padStart = (startDay + 6) % 7; // Mon-first

  // Total days in month
  const lastDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < padStart; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
  }

  // Bucket matches by day-of-month
  const byDay = new Map<number, EnrichedMatch[]>();
  for (const m of matches) {
    const d = new Date(m.kickoff_at);
    if (!isSameMonth(d, monthDate)) continue;
    const key = getDate(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(m);
  }

  return (
    <div>
      <h4 className="serif font-semibold text-[22px] tracking-[-0.015em] mb-3">
        {format(monthDate, "MMMM")} <i className="font-normal text-muted-warm">· {format(monthDate, "yyyy")}</i>
      </h4>
      <div className="grid grid-cols-7 gap-px bg-line border border-ink">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-ink text-paper px-2.5 py-2 mono text-[9px] tracking-[0.18em] uppercase text-center">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={i} className="bg-paper p-2.5 min-h-[76px]" />;
          }
          const day = getDate(cell);
          const dayMatches = byDay.get(day) ?? [];
          const groupCount = dayMatches.filter((m) => m.stage === "group").length;
          const knockoutCount = dayMatches.length - groupCount;
          const isFinal = dayMatches.some((m) => m.stage === "final");

          return (
            <div key={i} className="bg-paper p-2.5 min-h-[76px]">
              <div
                className={`serif font-semibold text-[14px] tracking-[-0.01em] ${
                  dayMatches.length > 0 ? "text-ink" : "text-muted-warm"
                }`}
              >
                {day}
              </div>
              {groupCount > 0 && (
                <div className="mt-1 mono text-[9px] tracking-[0.06em] px-1 py-px bg-blue-brand text-white inline-block">
                  {groupCount} GRP
                </div>
              )}
              {knockoutCount > 0 && !isFinal && (
                <div className="mt-1 mono text-[9px] tracking-[0.06em] px-1 py-px bg-ink text-paper inline-block">
                  {knockoutCount} KO
                </div>
              )}
              {isFinal && (
                <div className="mt-1 mono text-[9px] tracking-[0.06em] px-1 py-px bg-crown text-ink inline-block font-semibold">
                  FINAL
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
