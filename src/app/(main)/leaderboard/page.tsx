import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { format } from "date-fns";
import { AvatarUpload } from "@/components/leaderboard/avatar-upload";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardRow extends LeaderboardEntry {
  avatar_url: string | null;
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Pull leaderboard joined with avatar_url from profiles
  const { data: lbRaw } = await supabase
    .from("leaderboard")
    .select("user_id, display_name, total_points, correct_predictions, total_predictions, rank")
    .order("rank", { ascending: true });

  const userIds = (lbRaw ?? []).map((r) => r.user_id);
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, avatar_url")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const avatarById = new Map((profilesData ?? []).map((p) => [p.id, p.avatar_url]));

  const leaderboard: LeaderboardRow[] = (lbRaw ?? []).map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name,
    total_points: r.total_points,
    correct_predictions: r.correct_predictions,
    total_predictions: r.total_predictions,
    rank: r.rank,
    avatar_url: avatarById.get(r.user_id) ?? null,
    updated_at: "",
  }));

  const { count: totalPlayers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

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
              {leaderboard.length} OF {totalPlayers ?? leaderboard.length} PLAYERS
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
        <div className="mt-7 grid grid-cols-3 items-end border border-ink">
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

      {/* Table — places 4+ */}
      {leaderboard.length > 3 && (
        <div className="border border-ink border-t-0 bg-paper">
          <div className="grid grid-cols-[60px_1fr_100px_140px_70px] sm:grid-cols-[70px_1fr_100px_140px_70px] gap-4 px-5 py-3 mono text-[10px] font-bold tracking-[0.18em] uppercase text-muted-warm border-b border-ink">
            <div>Rank</div>
            <div>Player</div>
            <div className="text-right">Points</div>
            <div className="text-right hidden sm:block">Accuracy</div>
            <div className="text-right">Hits</div>
          </div>
          {leaderboard.slice(3).map((r) => {
            const isMe = r.user_id === user?.id;
            const accuracy =
              r.total_predictions > 0
                ? Math.round((r.correct_predictions / r.total_predictions) * 100)
                : 0;
            const initial = r.display_name.charAt(0).toUpperCase();

            return (
              <div
                key={r.user_id}
                className={`grid grid-cols-[60px_1fr_100px_140px_70px] sm:grid-cols-[70px_1fr_100px_140px_70px] gap-4 items-center px-5 py-3.5 border-b border-line last:border-b-0 transition-colors ${
                  isMe ? "bg-blue-brand/[0.06]" : "hover:bg-white/50"
                }`}
              >
                <div className="mono font-semibold text-muted-warm">
                  <span className="num">
                    {String(r.rank).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {r.avatar_url ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-paper">
                      <Image
                        src={r.avatar_url}
                        alt={r.display_name}
                        width={32}
                        height={32}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-ink text-paper grid place-items-center serif italic font-semibold text-[14px] tracking-[-0.02em]">
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="serif font-semibold text-[16px] tracking-[-0.015em] text-ink">
                        {r.display_name}
                      </span>
                      {isMe && (
                        <span className="mono text-[10px] tracking-[0.1em] uppercase text-blue-brand">
                          you
                        </span>
                      )}
                      {isMe && user && (
                        <AvatarUpload userId={user.id} currentUrl={r.avatar_url} />
                      )}
                    </div>
                    <span className="block mono text-[10px] tracking-[0.04em] text-muted-warm mt-0.5">
                      {accuracy}% accurate · {r.correct_predictions}/{r.total_predictions} hits
                    </span>
                  </div>
                </div>
                <div className="text-right serif font-semibold text-[22px] tracking-[-0.025em] num">
                  {r.total_points}
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1.5">
                  <span className="mono text-[11px] font-semibold">{accuracy}%</span>
                  <span className="w-[100px] h-[3px] bg-paper-deep">
                    <span className="block h-full bg-blue-brand" style={{ width: `${accuracy}%` }} />
                  </span>
                </div>
                <div className="text-right mono font-semibold text-ink">
                  {r.correct_predictions}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
    entry.total_predictions > 0
      ? Math.round((entry.correct_predictions / entry.total_predictions) * 100)
      : 0;
  const initial = entry.display_name.charAt(0).toUpperCase();

  const styles =
    place === 1
      ? "bg-ink text-paper py-9 px-6 [&_.roman]:text-crown"
      : place === 2
      ? "bg-blue-brand text-white py-7 px-6 [&_.roman]:text-white/85"
      : "bg-cream text-ink py-7 px-6 [&_.roman]:text-blue-brand";

  const romanMap = { 1: "I", 2: "II", 3: "III" };

  return (
    <div className={`text-center relative overflow-hidden border-r border-ink last:border-r-0 ${styles} ${isMe ? "ring-2 ring-blue-brand ring-inset" : ""}`}>
      <div className={`roman serif italic font-normal leading-[0.85] tracking-[-0.05em] ${
        place === 1 ? "text-[120px]" : "text-[80px]"
      }`}>
        {romanMap[place]}
      </div>
      {entry.avatar_url ? (
        <div className={`mx-auto rounded-full overflow-hidden mt-3.5 mb-3 border ${
          place === 1 ? "w-[72px] h-[72px] border-crown/40" : "w-14 h-14 border-current/20"
        }`}>
          <Image
            src={entry.avatar_url}
            alt={entry.display_name}
            width={place === 1 ? 72 : 56}
            height={place === 1 ? 72 : 56}
            className="object-cover w-full h-full"
          />
        </div>
      ) : (
        <div className={`mx-auto rounded-full mt-3.5 mb-3 grid place-items-center serif font-semibold tracking-[-0.02em] ${
          place === 1
            ? "w-[72px] h-[72px] text-[26px] bg-crown/20 text-crown"
            : place === 2
            ? "w-14 h-14 text-[20px] bg-white/18 text-white"
            : "w-14 h-14 text-[20px] bg-ink/10 text-ink"
        }`}>
          {initial}
        </div>
      )}
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
        <span>{accuracy}% acc</span>
        <span>{entry.correct_predictions}/{entry.total_predictions} hits</span>
      </div>
    </div>
  );
}

function PodiumPlaceholder({ place }: { place: 1 | 2 | 3 }) {
  const romanMap = { 1: "I", 2: "II", 3: "III" };
  return (
    <div className="text-center py-7 px-6 bg-paper-deep border-r border-ink last:border-r-0">
      <div className="serif italic text-[80px] font-normal leading-[0.85] tracking-[-0.05em] text-line">
        {romanMap[place]}
      </div>
      <p className="serif italic text-[16px] text-muted-warm mt-3">
        Awaiting<br />a contender
      </p>
    </div>
  );
}
