import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { NextPickCard } from "@/components/dashboard/next-pick-card";
import type { Match, Team, StageLock, PredictionChoice } from "@/lib/types";

const TOURNAMENT_START = new Date("2026-06-11T18:00:00Z");

type EnrichedMatch = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Profile + leaderboard
  const [{ data: profile }, { data: myRank }, { count: totalPlayers }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user!.id).single(),
    supabase.from("leaderboard").select("*").eq("user_id", user!.id).single(),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  // Predictions count + total matches
  const [{ count: predictionCount }, { count: totalMatches }] = await Promise.all([
    supabase.from("predictions").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase.from("matches").select("*", { count: "exact", head: true }),
  ]);

  // Stage locks
  const { data: stageLocksRaw } = await supabase.from("stage_locks").select("*");
  const stageLocks = (stageLocksRaw as StageLock[] | null) ?? [];
  const stageLockByStage = new Map(stageLocks.map((s) => [s.stage, s]));

  // Find next unpicked match in an open stage
  const openStages = stageLocks.filter((s) => s.predictions_open && !s.locked).map((s) => s.stage);
  let nextMatch: EnrichedMatch | null = null;
  let currentPick: PredictionChoice | null = null;
  let openMatchesTotal = 0;
  let openMatchesPicked = 0;

  let nextCrowd: { home: number; draw: number; away: number; total: number } | null = null;
  let currentScore: { home: number | null; away: number | null } | null = null;

  if (openStages.length > 0) {
    const { data: openMatches } = await supabase
      .from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)")
      .in("stage", openStages)
      .not("home_team_id", "is", null)
      .not("away_team_id", "is", null)
      .gt("kickoff_at", new Date().toISOString())
      .order("kickoff_at", { ascending: true });

    const openList = (openMatches as EnrichedMatch[] | null) ?? [];
    openMatchesTotal = openList.length;

    if (openList.length > 0) {
      const matchIds = openList.map((m) => m.id);
      const { data: existingPicks } = await supabase
        .from("predictions")
        .select("match_id, prediction, score_home, score_away")
        .eq("user_id", user!.id)
        .in("match_id", matchIds);

      const pickedSet = new Set(
        (existingPicks ?? [])
          .filter((p) => p.score_home != null && p.score_away != null)
          .map((p) => p.match_id)
      );
      openMatchesPicked = pickedSet.size;
      const firstUnpicked = openList.find((m) => !pickedSet.has(m.id));
      if (firstUnpicked) {
        nextMatch = firstUnpicked;
        const found = (existingPicks ?? []).find((p) => p.match_id === firstUnpicked.id);
        if (found) {
          currentPick = (found.prediction as PredictionChoice) ?? null;
          currentScore = { home: found.score_home ?? null, away: found.score_away ?? null };
        }
      } else {
        nextMatch = openList[0];
        const found = (existingPicks ?? []).find((p) => p.match_id === openList[0].id);
        currentPick = (found?.prediction as PredictionChoice) ?? null;
        currentScore = found ? { home: found.score_home ?? null, away: found.score_away ?? null } : null;
      }

      if (nextMatch) {
        const { data: crowdRows } = await supabase
          .from("match_crowd")
          .select("prediction, pct, total_picks")
          .eq("match_id", nextMatch.id);
        if (crowdRows && crowdRows.length > 0) {
          nextCrowd = { home: 0, draw: 0, away: 0, total: crowdRows[0].total_picks };
          crowdRows.forEach((r) => {
            if (r.prediction === "home") nextCrowd!.home = r.pct;
            if (r.prediction === "draw") nextCrowd!.draw = r.pct;
            if (r.prediction === "away") nextCrowd!.away = r.pct;
          });
        }
      }
    }
  }

  // Per-stage match counts (for tournament arc)
  const stageEarliestKickoff: Record<string, string | null> = {};
  for (const stage of STAGE_ORDER) {
    const { data } = await supabase
      .from("matches")
      .select("kickoff_at")
      .eq("stage", stage)
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    stageEarliestKickoff[stage] = data?.kickoff_at ?? null;
  }

  const daysToStart = Math.max(
    0,
    Math.ceil((TOURNAMENT_START.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  // Tournament progress — which stage is being played, and what's next
  const nowMs = Date.now();
  const stageFlow = STAGE_ORDER.filter((s) => s !== "third_place");
  const startedStages = stageFlow.filter(
    (s) => stageEarliestKickoff[s] && new Date(stageEarliestKickoff[s]!).getTime() <= nowMs
  );
  const currentStage = startedStages[startedStages.length - 1] ?? stageFlow[0];
  const upcomingStages = stageFlow.filter(
    (s) => stageEarliestKickoff[s] && new Date(stageEarliestKickoff[s]!).getTime() > nowMs
  );
  const nextStage = upcomingStages[0] ?? null;
  const daysToNextStage = nextStage
    ? Math.max(0, Math.ceil((new Date(stageEarliestKickoff[nextStage]!).getTime() - nowMs) / 86400000))
    : 0;
  const tournamentLive = startedStages.length > 0 || daysToStart === 0;

  // Accuracy = correct results / matches actually decided (finished), NOT total picks.
  // Dividing by all 72 picks made "got 1 of 1 right" show as ~1%.
  const { count: decidedCount } = await supabase
    .from("predictions")
    .select("id, match:matches!inner(status)", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("match.status", "finished");

  const accuracy =
    myRank && decidedCount && decidedCount > 0
      ? Math.round((myRank.correct_predictions / decidedCount) * 100)
      : null;

  const ordinalRank = myRank ? ordinal(myRank.rank) : null;

  // Compute current streak (consecutive correct picks ending at most-recent finished match)
  // and last 7 days points delta vs prior 7 days
  let streak = 0;
  let lastLossLabel: string | null = null;
  let weekDelta = 0;
  {
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const fourteenAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const [{ data: recent }, { data: weekRows }, { data: priorWeekRows }] = await Promise.all([
      supabase
        .from("predictions")
        .select(
          "points_awarded, prediction, match:matches!inner(id,result,home_team:teams!matches_home_team_id_fkey(short_code),away_team:teams!matches_away_team_id_fkey(short_code),status,kickoff_at)"
        )
        .eq("user_id", user!.id)
        .eq("match.status", "finished")
        .order("kickoff_at", { ascending: false, referencedTable: "matches" })
        .limit(20),
      supabase
        .from("predictions")
        .select("points_awarded, match:matches!inner(kickoff_at)")
        .eq("user_id", user!.id)
        .gte("match.kickoff_at", sevenAgo),
      supabase
        .from("predictions")
        .select("points_awarded, match:matches!inner(kickoff_at)")
        .eq("user_id", user!.id)
        .gte("match.kickoff_at", fourteenAgo)
        .lt("match.kickoff_at", sevenAgo),
    ]);

    type RecentRow = {
      points_awarded: number;
      prediction: string;
      match:
        | {
            result: string | null;
            home_team: { short_code: string } | { short_code: string }[] | null;
            away_team: { short_code: string } | { short_code: string }[] | null;
          }
        | Array<{
            result: string | null;
            home_team: { short_code: string } | { short_code: string }[] | null;
            away_team: { short_code: string } | { short_code: string }[] | null;
          }>;
    };
    const recentList = (recent ?? []) as unknown as RecentRow[];
    const pickFirst = <T,>(v: T | T[] | null | undefined): T | null => {
      if (!v) return null;
      return Array.isArray(v) ? v[0] ?? null : v;
    };
    for (const row of recentList) {
      const m = pickFirst(row.match);
      if (!m || !m.result) continue;
      if (row.points_awarded > 0) {
        streak++;
      } else {
        const home = pickFirst(m.home_team)?.short_code;
        const away = pickFirst(m.away_team)?.short_code;
        const winner = m.result === "home" ? home : m.result === "away" ? away : "DRAW";
        if (winner) lastLossLabel = `lost to ${winner}`;
        break;
      }
    }

    const sumPoints = (rows: Array<{ points_awarded: number }> | null) =>
      (rows ?? []).reduce((acc, r) => acc + (r.points_awarded ?? 0), 0);
    weekDelta = sumPoints(weekRows as Array<{ points_awarded: number }> | null) - sumPoints(priorWeekRows as Array<{ points_awarded: number }> | null);
  }

  return (
    <div>
      {/* Page head */}
      <header className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end pb-6 border-b border-ink">
        <div>
          <div className="flex items-center gap-3.5 mb-4">
            <span className="mono text-[11px] tracking-[0.12em] text-muted-warm uppercase">
              DASH · {format(new Date(), "d MMM yyyy").toUpperCase()}
            </span>
            <span className="flex-1 h-px bg-line" />
            <span className="mono text-[11px] tracking-[0.12em] text-muted-warm uppercase">
              OFFICE POOL · {totalPlayers ?? 0} PLAYERS
            </span>
          </div>
          <h1 className="display-heading text-[64px] sm:text-[88px] leading-[0.88] tracking-[-0.045em] text-ink">
            Hi, {profile?.display_name?.split(" ")[0] ?? "Player"}<i>.</i>
            {ordinalRank && (
              <>
                <br />
                You&apos;re <i>{ordinalRank}</i>
              </>
            )}
          </h1>
        </div>
        <div className="lg:text-right pb-3">
          <p className="serif italic text-[18px] text-muted-warm leading-snug max-w-[320px] lg:ml-auto">
            {openStages.length > 0
              ? `${openStages.map((s) => STAGE_LABELS[s]).join(", ")} ${openStages.length === 1 ? "is" : "are"} open — the board moves fast from here.`
              : "Predictions reopen with the next stage."}
          </p>
          <div className="mono text-[10px] uppercase tracking-[0.16em] text-muted-warm mt-3.5">
            {predictionCount ?? 0} / {totalMatches ?? 0} picked total
          </div>
        </div>
      </header>

      {/* Two-column grid */}
      <div className="pt-7 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        {/* Countdown block (left, dark) */}
        <div className="relative overflow-hidden bg-ink text-paper p-9 min-h-[380px]">
          <div className="absolute inset-0 opacity-55 mix-blend-luminosity bg-cover bg-[center_right]"
            style={{ backgroundImage: "url(/hero-bg.webp)" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, var(--ink) 0%, rgba(10,10,20,0.78) 45%, rgba(10,10,20,0.45) 70%, rgba(10,10,20,0.85) 100%)",
            }}
          />
          <div className="relative">
            <div className="flex justify-between items-start">
              <span className="mono text-[10px] tracking-[0.22em] uppercase font-bold text-blue-bright">
                {tournamentLive ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-[7px] h-[7px] rounded-full bg-blue-bright pulse-dot" />
                    Tournament · Live
                  </span>
                ) : (
                  "Tournament starts"
                )}
              </span>
              <span className="mono text-[10px] tracking-[0.18em] uppercase text-paper/40">
                ▸ 11 JUN — 19 JUL · 104 MATCHES
              </span>
            </div>

            {tournamentLive ? (
              <>
                <div className="serif font-semibold text-[38px] tracking-[-0.025em] leading-none mt-3.5">
                  It&apos;s <i className="text-blue-bright">live</i>.
                </div>
                <div className="mt-3 mono text-[11px] tracking-[0.18em] uppercase text-paper/60">
                  Currently playing ·{" "}
                  <b className="text-paper font-medium">{STAGE_LABELS[currentStage]}</b>
                </div>
                {nextStage ? (
                  <div className="mt-5 flex items-end gap-3.5">
                    <span className="serif font-semibold text-[180px] sm:text-[220px] tracking-[-0.07em] leading-[0.78] num">
                      {daysToNextStage}
                    </span>
                    <div className="pb-3.5 mono text-[11px] tracking-[0.18em] uppercase text-paper/55 leading-[1.4] max-w-[120px]">
                      {daysToNextStage === 1 ? "day" : "days"} to<br />
                      <b className="text-paper font-medium">{STAGE_LABELS[nextStage]}</b>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 serif font-semibold text-[88px] sm:text-[110px] tracking-[-0.05em] leading-[0.85] text-paper">
                    The <i className="text-blue-bright">final</i> stretch.
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="serif font-semibold text-[38px] tracking-[-0.025em] leading-none mt-3.5">
                  The wait is <i className="text-blue-bright">almost</i> over.
                </div>
                <div className="mt-5 flex items-end gap-3.5">
                  <span className="serif font-semibold text-[180px] sm:text-[220px] tracking-[-0.07em] leading-[0.78] num">
                    {daysToStart}
                  </span>
                  <div className="pb-3.5 mono text-[11px] tracking-[0.18em] uppercase text-paper/55 leading-[1.4] max-w-[96px]">
                    days<br />
                    to <b className="text-paper font-medium">kickoff</b>
                  </div>
                </div>
              </>
            )}
            <div className="mt-6 pt-4 border-t border-paper/15 grid grid-cols-3 gap-6">
              <Stat label="Picks made" value={`${predictionCount ?? 0}`} sub={`/${totalMatches ?? 104}`} />
              <Stat label="Open now" value={`${openMatchesPicked}`} sub={`/${openMatchesTotal}`} />
              <Stat
                label="Δ this week"
                value={weekDelta > 0 ? `+${weekDelta}` : `${weekDelta}`}
                sub="pts"
                accent={weekDelta > 0}
              />
            </div>
          </div>
        </div>

        {/* Stats stack (right) */}
        <div className="grid">
          <StatBox
            label="Office rank"
            value={myRank ? `#${myRank.rank}` : "—"}
            sup={myRank ? ordinalSuffix(myRank.rank) : undefined}
            sub={myRank ? `${myRank.total_points} PTS · ${totalPlayers ?? 0} PLAYERS` : "no results yet"}
            feature
          />
          <StatBox
            label="Accuracy"
            value={accuracy !== null ? `${accuracy}` : "—"}
            sup={accuracy !== null ? "%" : undefined}
            sub={
              decidedCount && decidedCount > 0
                ? `${myRank?.correct_predictions ?? 0} / ${decidedCount} PLAYED`
                : "no results yet"
            }
          />
          <StatBox
            label="Streak"
            value={`${streak}`}
            sup={streak > 0 ? "W" : undefined}
            sub={streak > 0 ? (lastLossLabel ?? "ON A ROLL") : "NO HITS YET"}
          />
        </div>

        {/* Next pick (left col, row 2) */}
        <div>
          <NextPickCard
            match={nextMatch}
            currentPick={currentPick}
            currentScore={currentScore}
            remainingOpen={openMatchesTotal - openMatchesPicked}
            totalOpen={openMatchesTotal}
            userId={user!.id}
            crowd={nextCrowd}
          />
        </div>

        {/* Tournament arc (full width) */}
        <div className="lg:col-span-2 border border-ink p-6 bg-paper">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="serif italic text-[22px] text-ink">
              Tournament <span className="serif italic text-muted-warm">arc</span>
            </h2>
            <div className="hidden sm:flex gap-4 mono text-[10px] uppercase tracking-[0.1em] text-muted-warm">
              <Legend dot="bg-ink" label="Locked" />
              <Legend dot="bg-blue-brand" label="Open now" />
              <Legend dot="bg-paper-deep border border-line" label="Upcoming" />
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-1">
            {STAGE_ORDER.filter((s) => s !== "third_place").map((stage) => {
              const sl = stageLockByStage.get(stage);
              const status = sl?.predictions_open && !sl?.locked
                ? "live"
                : sl?.locked
                ? "done"
                : "upcoming";
              const when = stageEarliestKickoff[stage]
                ? format(new Date(stageEarliestKickoff[stage]!), "d MMM")
                : "TBD";
              return (
                <Link
                  key={stage}
                  href="/predictions"
                  className="block pt-1 pb-2 cursor-pointer hover:opacity-70 transition-opacity"
                >
                  <div
                    className={`serif font-semibold text-[14px] tracking-[-0.01em] ${
                      status === "live"
                        ? "text-blue-brand"
                        : status === "done"
                        ? "text-muted-warm"
                        : "text-ink"
                    }`}
                  >
                    {STAGE_LABELS[stage]}
                  </div>
                  <div className="mono text-[10px] tracking-[0.06em] text-muted-warm mt-0.5">
                    {when}
                  </div>
                  <div
                    className={`mt-2.5 ${
                      status === "live"
                        ? "h-[6px] bg-blue-brand shadow-[0_0_0_3px_rgba(47,79,252,0.18)]"
                        : status === "done"
                        ? "h-[4px] bg-ink"
                        : "h-[4px] bg-paper-deep"
                    }`}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const word: Record<number, string> = {
    1: "first",
    2: "second",
    3: "third",
    4: "fourth",
    5: "fifth",
    6: "sixth",
    7: "seventh",
    8: "eighth",
    9: "ninth",
    10: "tenth",
  };
  if (word[n]) return word[n];
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.18em] uppercase text-paper/50">{label}</div>
      <div
        className={`serif italic font-semibold text-[28px] leading-none mt-1.5 ${
          accent ? "text-blue-bright" : "text-paper"
        }`}
      >
        {value}
        {sub && <u className="not-italic text-paper/40 ml-1 text-[14px] no-underline">{sub}</u>}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sup,
  sub,
  feature,
}: {
  label: string;
  value: string;
  sup?: string;
  sub: string;
  feature?: boolean;
}) {
  return (
    <div
      className={`p-5 grid grid-cols-[1fr_auto] items-center gap-4 border border-ink ${
        feature ? "bg-blue-brand text-white border-blue-brand" : "bg-transparent"
      } [&:not(:last-child)]:border-b-0 [&:first-child:not(:only-child)]:border-b-0`}
    >
      <div className="min-w-0">
        <div
          className={`mono text-[10px] tracking-[0.18em] uppercase font-bold ${
            feature ? "text-white/70" : "text-muted-warm"
          }`}
        >
          {label}
        </div>
        <div
          className={`serif mt-2.5 flex items-start gap-1 ${
            feature ? "text-white" : "text-ink"
          }`}
        >
          <span className="font-semibold text-[52px] leading-[0.85] tracking-[-0.04em]">
            {value}
          </span>
          {sup && (
            <span
              className={`text-[18px] italic font-normal leading-none mt-1.5 ${
                feature ? "text-white/75" : "text-muted-warm"
              }`}
            >
              {sup}
            </span>
          )}
        </div>
        <div
          className={`mono text-[11px] tracking-[0.06em] mt-3 ${
            feature ? "text-white/78" : "text-muted-warm"
          }`}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-[7px] h-[7px] rounded-full ${dot}`} />
      {label}
    </span>
  );
}
