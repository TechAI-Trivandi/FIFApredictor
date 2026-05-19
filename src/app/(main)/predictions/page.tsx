import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { PredictionsList, type CrowdMap } from "@/components/predictions-list";
import { LockCountdown } from "@/components/lock-countdown";
import type { Match, Prediction, Team, StageLock } from "@/lib/types";

const TOURNAMENT_START = new Date("2026-06-11T18:00:00Z");

export default async function PredictionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: matches } = await supabase
    .from("matches")
    .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)")
    .order("match_number", { ascending: true });

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", user!.id);

  const { data: stageLocks } = await supabase.from("stage_locks").select("*");

  // Crowd intelligence (% of office picking each option per match)
  const { data: crowdRows } = await supabase
    .from("match_crowd")
    .select("match_id, prediction, pct, total_picks");
  const crowd: CrowdMap = {};
  (crowdRows ?? []).forEach((r) => {
    const entry = crowd[r.match_id] ?? { home: 0, draw: 0, away: 0, total: 0 };
    entry.total = r.total_picks;
    if (r.prediction === "home") entry.home = r.pct;
    if (r.prediction === "draw") entry.draw = r.pct;
    if (r.prediction === "away") entry.away = r.pct;
    crowd[r.match_id] = entry;
  });

  const predictionMap: Record<number, Prediction> = {};
  predictions?.forEach((p) => {
    predictionMap[p.match_id] = p;
  });

  const stageLockMap: Record<string, StageLock> = {};
  (stageLocks as StageLock[] | null)?.forEach((sl) => {
    stageLockMap[sl.stage] = sl;
  });

  // Lock-in target = kickoff of the soonest open-stage match
  const openStages = (stageLocks as StageLock[] | null)?.filter(
    (s) => s.predictions_open && !s.locked
  ) ?? [];
  let lockAt: string | null = null;
  if (openStages.length > 0) {
    const stages = openStages.map((s) => s.stage);
    const { data: nextMatch } = await supabase
      .from("matches")
      .select("kickoff_at")
      .in("stage", stages)
      .gt("kickoff_at", new Date().toISOString())
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    lockAt = nextMatch?.kickoff_at ?? null;
  }

  const stagesPlayed = (stageLocks as StageLock[] | null)?.filter((s) => s.locked).length ?? 0;
  const stagesTotal = (stageLocks as StageLock[] | null)?.length ?? 7;

  return (
    <div>
      {/* Page head */}
      <header className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end pb-6 border-b border-ink">
        <div>
          <div className="flex items-center gap-3.5 mb-4">
            <span className="mono text-[11px] tracking-[0.12em] text-muted-warm uppercase">
              PRED · STAGE {stagesPlayed + 1} OF {stagesTotal}
            </span>
            <span className="flex-1 h-px bg-line" />
            <span className="mono text-[11px] tracking-[0.12em] text-muted-warm uppercase">
              <LockCountdown lockAt={lockAt} />
            </span>
          </div>
          <h1 className="display-heading text-[64px] sm:text-[88px] leading-[0.88] tracking-[-0.045em] text-ink">
            Make your<br />
            <i>picks.</i>
          </h1>
        </div>
        <div className="lg:text-right pb-3">
          <p className="serif italic text-[18px] text-muted-warm leading-snug max-w-[320px] lg:ml-auto">
            Predict the score — +5 pts for exact, +2 for correct result.
          </p>
          <div className="mono text-[10px] uppercase tracking-[0.16em] text-muted-warm mt-3.5">
            {format(TOURNAMENT_START, "d MMM").toUpperCase()} — 19 JUL · 104 MATCHES
          </div>
        </div>
      </header>

      <PredictionsList
        matches={(matches as (Match & { home_team: Team | null; away_team: Team | null })[]) ?? []}
        predictions={predictionMap}
        stageLocks={stageLockMap}
        userId={user!.id}
        crowd={crowd}
      />
    </div>
  );
}
