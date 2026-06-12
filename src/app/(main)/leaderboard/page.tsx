import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { format } from "date-fns";
import { AvatarUpload } from "@/components/leaderboard/avatar-upload";
import { PlayerAvatar } from "@/components/leaderboard/player-popup";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardRow extends LeaderboardEntry {
  avatar_url: string | null;
  form: number[]; // last 5 scored predictions: 0 | 2 | 5
  decided_predictions: number; // finished matches the user predicted (accuracy denominator)
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Pull leaderboard
  const { data: lbRaw } = await supabase
    .from("leaderboard")
    .select("user_id, display_name, total_points, correct_predictions, total_predictions, rank, previous_rank, weekly_points")
    .order("rank", { ascending: true });

  // Pull ALL profiles (including those not yet in leaderboard table)
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url");
  const avatarById = new Map((profilesData ?? []).map((p) => [p.id, p.avatar_url]));
  const lbUserIds = new Set((lbRaw ?? []).map((r) => r.user_id));

  // Form data: last 5 scored predictions per user
  const { data: finishedMatches } = await supabase
    .from("matches")
    .select("id, kickoff_at")
    .eq("status", "finished")
    .order("kickoff_at", { ascending: false });

  const finishedIds = new Set((finishedMatches ?? []).map((m) => m.id));
  const finishedOrder = (finishedMatches ?? []).map((m) => m.id);
  const finishedIdArray = (finishedMatches ?? []).map((m) => m.id);

  // Fetch ALL predictions for finished matches. Supabase hard-caps every request
  // at 1000 rows (and .range() can't exceed it), so we paginate with an explicit
  // order until a short page comes back. Filtering to finished matches keeps the
  // volume down; pagination makes it correct even with thousands of predictions.
  const allPreds: { user_id: string; match_id: number; points_awarded: number }[] = [];
  if (finishedIdArray.length > 0) {
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from("predictions")
        .select("user_id, match_id, points_awarded")
        .in("match_id", finishedIdArray)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      allPreds.push(...data);
      if (data.length < PAGE) break;
    }
  }

  // Group predictions by user, sorted by most-recent match first
  const formMap: Record<string, number[]> = {};
  const predsByUser: Record<string, { match_id: number; points: number }[]> = {};
  for (const p of allPreds) {
    if (!finishedIds.has(p.match_id)) continue;
    if (!predsByUser[p.user_id]) predsByUser[p.user_id] = [];
    predsByUser[p.user_id].push({ match_id: p.match_id, points: p.points_awarded });
  }
  // Accuracy denominator = matches that have actually been decided (finished)
  // that the user predicted — NOT their total picks across the whole tournament.
  const decidedMap: Record<string, number> = {};
  const correctMap: Record<string, number> = {};
  for (const [uid, preds] of Object.entries(predsByUser)) {
    // preds sorted most-recent-first (finishedOrder is kickoff DESC)
    preds.sort(
      (a, b) => finishedOrder.indexOf(a.match_id) - finishedOrder.indexOf(b.match_id)
    );
    // Take the 5 most recent, then reverse to chronological order so the blocks
    // read oldest → newest left-to-right (newest on the right, like a form guide).
    formMap[uid] = preds.slice(0, 5).map((p) => p.points).reverse();
    decidedMap[uid] = preds.length;
    correctMap[uid] = preds.filter((p) => p.points > 0).length;
  }

  // Users already in leaderboard table
  const ranked: LeaderboardRow[] = (lbRaw ?? []).map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name,
    total_points: r.total_points,
    correct_predictions: r.correct_predictions,
    total_predictions: r.total_predictions,
    rank: r.rank,
    previous_rank: r.previous_rank ?? null,
    weekly_points: r.weekly_points ?? 0,
    avatar_url: avatarById.get(r.user_id) ?? null,
    form: formMap[r.user_id] ?? [],
    decided_predictions: decidedMap[r.user_id] ?? 0,
    updated_at: "",
  }));

  // Users who signed up but aren't in the leaderboard table yet
  const unranked: LeaderboardRow[] = (profilesData ?? [])
    .filter((p) => !lbUserIds.has(p.id))
    .map((p) => ({
      user_id: p.id,
      display_name: p.display_name ?? "Unknown",
      total_points: 0,
      correct_predictions: 0,
      total_predictions: 0,
      rank: ranked.length + 1, // tied last
      previous_rank: null,
      weekly_points: 0,
      avatar_url: p.avatar_url ?? null,
      form: [],
      decided_predictions: 0,
      updated_at: "",
    }));

  // Order: by rank (points), then push players who haven't predicted any decided
  // match to the bottom of their tier — so "guessed wrong" (has form) sits above
  // "didn't guess" (no form) instead of being mixed together.
  const leaderboard = [...ranked, ...unranked].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const aPlayed = a.decided_predictions > 0 ? 1 : 0;
    const bPlayed = b.decided_predictions > 0 ? 1 : 0;
    if (aPlayed !== bPlayed) return bPlayed - aPlayed; // players with results first
    return a.display_name.localeCompare(b.display_name); // stable within group
  });
  const totalPlayers = leaderboard.length;

  return (
    <div>
      {/* Page head */}
      <header className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end pb-6 border-b border-ink">
        <div>
          <div className="flex items-center gap-3.5 mb-4">
            <span className="mono text-[11px] tracking-[0.12em] text-muted-warm uppercase">
              LBD · {format(new Date(), "d MMM yyyy").toUpperCase()}
            </span>
            <span className="flex-1 h-px bg-line" />
            <span className="mono text-[11px] tracking-[0.12em] text-muted-warm uppercase">
              {totalPlayers} PLAYERS
            </span>
          </div>
          <h1 className="display-heading text-[64px] sm:text-[88px] leading-[0.88] tracking-[-0.045em] text-ink">
            Who&apos;s<br />
            <i>topping</i> the office.
          </h1>
        </div>
        <div className="lg:text-right pb-3">
          <p className="serif italic text-[18px] text-muted-warm leading-snug max-w-[320px] lg:ml-auto">
            Live standings — updated as match results land.
          </p>
        </div>
      </header>

      {/* Empty state */}
      {leaderboard.length === 0 && (
        <div className="mt-16 text-center">
          <p className="serif italic text-[24px] text-muted-warm">
            The leaderboard wakes up after the first match.
          </p>
        </div>
      )}

      {/* Podium */}
      {leaderboard.length >= 1 && (
        <div className="mt-7 grid grid-cols-3 items-end gap-[3px]">
          {leaderboard[1] ? (
            <PodiumSeat entry={leaderboard[1]} place={2} isMe={leaderboard[1].user_id === user?.id} />
          ) : (
            <PodiumPlaceholder place={2} />
          )}
          <PodiumSeat entry={leaderboard[0]} place={1} isMe={leaderboard[0].user_id === user?.id} />
          {leaderboard[2] ? (
            <PodiumSeat entry={leaderboard[2]} place={3} isMe={leaderboard[2].user_id === user?.id} />
          ) : (
            <PodiumPlaceholder place={3} />
          )}
        </div>
      )}

      {/* Full table — all players */}
      {leaderboard.length > 0 && (
        <div className="border border-ink mt-5 bg-paper">
          {/* Header */}
          <div className="grid grid-cols-[56px_1fr_72px] sm:grid-cols-[70px_1fr_80px_80px_110px_70px] gap-2 sm:gap-4 px-4 sm:px-5 py-3 mono text-[9px] sm:text-[10px] font-bold tracking-[0.18em] uppercase text-muted-warm border-b border-ink">
            <div>Rank</div>
            <div>Player</div>
            <div className="text-right">Points</div>
            <div className="text-right hidden sm:block">Accuracy</div>
            <div className="text-right hidden sm:block">Form / 5</div>
            <div className="text-right hidden sm:block">&Delta; Week</div>
          </div>

          {/* Rows */}
          {leaderboard.map((r, index) => {
            const isMe = r.user_id === user?.id;
            const accuracy =
              r.decided_predictions > 0
                ? Math.round((r.correct_predictions / r.decided_predictions) * 100)
                : null;
            const initial = r.display_name.charAt(0).toUpperCase();
            const rankDelta =
              r.previous_rank != null ? r.previous_rank - r.rank : null;

            const medalColor =
              index === 0 ? "bg-gold"
              : index === 1 ? "bg-silver"
              : index === 2 ? "bg-bronze"
              : null;

            return (
              <div
                key={r.user_id}
                className={`relative grid grid-cols-[56px_1fr_72px] sm:grid-cols-[70px_1fr_80px_80px_110px_70px] gap-2 sm:gap-4 items-center px-4 sm:px-5 py-3 sm:py-3.5 border-b border-line last:border-b-0 transition-colors ${
                  isMe ? "bg-blue-brand/[0.06]" : "hover:bg-white/50"
                }`}
              >
                {/* Medal accent bar — inset so it doesn't touch horizontal dividers */}
                {medalColor && (
                  <div className={`absolute left-0 top-[4px] bottom-[4px] w-[3px] ${medalColor}`} />
                )}
                {/* Rank + movement */}
                <div className="mono font-semibold text-muted-warm flex items-center gap-1">
                  <span className="num text-[13px]">
                    {String(r.rank).padStart(2, "0")}
                  </span>
                  <RankDelta delta={rankDelta} />
                </div>

                {/* Player */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <PlayerAvatar
                    player={r}
                    size={32}
                    className="border border-paper"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="serif font-semibold text-[15px] sm:text-[16px] tracking-[-0.015em] text-ink truncate">
                        {r.display_name}
                      </span>
                      {isMe && (
                        <span className="mono text-[10px] tracking-[0.1em] uppercase text-blue-brand shrink-0">
                          you
                        </span>
                      )}
                      {isMe && user && (
                        <AvatarUpload userId={user.id} currentUrl={r.avatar_url} />
                      )}
                    </div>
                    <span className="block mono text-[10px] tracking-[0.04em] text-muted-warm mt-0.5">
                      {accuracy != null ? `${accuracy}% accurate` : "no results yet"} · {r.total_points} pts total
                    </span>
                  </div>
                </div>

                {/* Points */}
                <div className="text-right serif font-semibold text-[20px] sm:text-[22px] tracking-[-0.025em] num">
                  {r.total_points}
                </div>

                {/* Accuracy */}
                <div className="hidden sm:block text-right mono text-[12px] font-semibold">
                  {accuracy != null ? `${accuracy}%` : "–"}
                </div>

                {/* Form / 5 */}
                <div className="hidden sm:flex items-center justify-end gap-[3px]">
                  <FormBlocks form={r.form} />
                </div>

                {/* Δ Week */}
                <div className="hidden sm:block text-right">
                  <WeeklyDelta points={r.weekly_points} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Podium Seat ──────────────────────────────────────────── */
function PodiumSeat({
  entry,
  place,
  isMe,
}: {
  entry: LeaderboardRow;
  place: 1 | 2 | 3;
  isMe: boolean;
}) {
  const accuracy =
    entry.decided_predictions > 0
      ? Math.round((entry.correct_predictions / entry.decided_predictions) * 100)
      : null;
  const initial = entry.display_name.charAt(0).toUpperCase();
  const rankDelta =
    entry.previous_rank != null ? entry.previous_rank - entry.rank : null;

  const styles =
    place === 1
      ? "bg-gold text-white py-8 px-6"
      : place === 2
      ? "bg-silver text-white py-10 px-6"
      : "bg-bronze text-white py-5 px-6";

  const romanCls =
    place === 1
      ? "text-[120px] text-white"
      : place === 2
      ? "text-[80px] text-white"
      : "text-[80px] text-white";

  const avatarBorder =
    place === 1
      ? "border-[3px] border-white"
      : place === 2
      ? "border-[3px] border-white"
      : "border-[3px] border-white";

  const initialsStyle =
    place === 1
      ? "w-[78px] h-[78px] text-[26px] bg-white/25 text-white border-[3px] border-white"
      : place === 2
      ? "w-[62px] h-[62px] text-[20px] bg-white/20 text-white border-[3px] border-white"
      : "w-[62px] h-[62px] text-[20px] bg-white/20 text-white border-[3px] border-white";

  const romanMap = { 1: "I", 2: "II", 3: "III" };

  return (
    <div className={`text-center relative overflow-hidden ${styles}`}>
      <div className={`serif italic font-normal leading-[0.85] tracking-[-0.05em] ${romanCls}`}>
        {romanMap[place]}
      </div>
      <div className="flex justify-center mt-3.5 mb-3">
        <PlayerAvatar
          player={entry}
          size={place === 1 ? 78 : 62}
          className={avatarBorder}
          initialsBg="bg-white/20 text-white"
        />
      </div>
      <div className={`serif font-semibold tracking-[-0.015em] ${
        place === 1 ? "text-[22px]" : "text-[18px]"
      }`}>
        {entry.display_name}
        {isMe && <span className="ml-1.5 mono text-[10px] tracking-[0.1em] uppercase opacity-70">you</span>}
      </div>
      <div className={`serif font-semibold tracking-[-0.035em] leading-none mt-3.5 num ${
        place === 1 ? "text-[64px]" : "text-[44px]"
      }`}>
        {entry.total_points}
        <span className="mono font-medium tracking-[0.18em] uppercase opacity-60 ml-1.5 align-[12px] text-[10px]">
          pts
        </span>
      </div>
      <div className="flex gap-3 justify-center mt-3.5 mono text-[10px] tracking-[0.1em] uppercase opacity-75">
        <span>{accuracy != null ? `${accuracy}% acc` : "no results"}</span>
        {rankDelta != null && rankDelta !== 0 && (
          <span>{rankDelta > 0 ? `▲ ${rankDelta}` : `▼ ${Math.abs(rankDelta)}`}</span>
        )}
        {(rankDelta == null || rankDelta === 0) && (
          <span>{entry.correct_predictions}/{entry.total_predictions} hits</span>
        )}
      </div>
    </div>
  );
}

/* ── Podium Placeholder ───────────────────────────────────── */
function PodiumPlaceholder({ place }: { place: 1 | 2 | 3 }) {
  const romanMap = { 1: "I", 2: "II", 3: "III" };
  return (
    <div className="text-center py-7 px-6 bg-paper-deep">
      <div className="serif italic text-[80px] font-normal leading-[0.85] tracking-[-0.05em] text-line">
        {romanMap[place]}
      </div>
      <p className="serif italic text-[16px] text-muted-warm mt-3">
        Awaiting<br />a contender
      </p>
    </div>
  );
}

/* ── Rank Delta Arrow ─────────────────────────────────────── */
function RankDelta({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) {
    return <span className="mono text-[10px] text-muted-warm/50">–</span>;
  }
  if (delta > 0) {
    return (
      <span className="mono text-[10px] text-good font-bold">
        ▲&thinsp;{delta}
      </span>
    );
  }
  return (
    <span className="mono text-[10px] text-bad font-bold">
      ▼&thinsp;{Math.abs(delta)}
    </span>
  );
}

/* ── Form Blocks (last 5 results) ─────────────────────────── */
function FormBlocks({ form }: { form: number[] }) {
  // Pad to 5 blocks
  const blocks = [...form];
  while (blocks.length < 5) blocks.push(-1); // -1 = empty

  return (
    <>
      {blocks.map((pts, i) => {
        let bg: string;
        if (pts === 5) bg = "bg-good";          // exact score
        else if (pts === 2) bg = "bg-crown";     // correct result
        else if (pts === 0) bg = "bg-bad";       // wrong
        else bg = "bg-paper-deep";               // no data

        return (
          <span
            key={i}
            className={`inline-block w-[16px] h-[16px] ${bg}`}
            title={pts === 5 ? "Exact +5" : pts === 2 ? "Result +2" : pts === 0 ? "Wrong" : "–"}
          />
        );
      })}
    </>
  );
}

/* ── Weekly Delta ─────────────────────────────────────────── */
function WeeklyDelta({ points }: { points: number }) {
  if (points === 0) {
    return <span className="mono text-[12px] text-muted-warm">0</span>;
  }
  return (
    <span className={`mono text-[12px] font-bold ${points > 0 ? "text-good" : "text-bad"}`}>
      {points > 0 ? "+" : ""}{points}
    </span>
  );
}
