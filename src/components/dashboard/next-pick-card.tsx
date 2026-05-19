"use client";

import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { STAGE_LABELS } from "@/lib/constants";
import type { Match, PredictionChoice, Team } from "@/lib/types";

type EnrichedMatch = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

interface Props {
  match: EnrichedMatch | null;
  currentPick: PredictionChoice | null;
  currentScore?: { home: number | null; away: number | null } | null;
  remainingOpen: number;
  totalOpen: number;
  userId: string;
  crowd?: { home: number; draw: number; away: number; total: number } | null;
}

export function NextPickCard({ match, currentPick, currentScore, remainingOpen, totalOpen }: Props) {
  if (!match || !match.home_team || !match.away_team) {
    return (
      <div className="border border-ink bg-paper-deep p-6">
        <div className="flex items-baseline justify-between border-b border-ink pb-3 mb-4">
          <h3 className="serif italic text-[22px] text-ink">Your next pick</h3>
          <span className="mono text-[10px] uppercase tracking-[0.16em] text-muted-warm">
            Nothing pending
          </span>
        </div>
        <p className="serif italic text-[15px] text-muted-warm leading-snug">
          You&apos;re all caught up. New matches will land here as stages unlock.
        </p>
      </div>
    );
  }

  const stageLabel = STAGE_LABELS[match.stage] ?? match.stage;
  const home = match.home_team;
  const away = match.away_team;
  const hasScore = currentScore?.home != null && currentScore?.away != null;

  return (
    <div className="border border-ink bg-paper-deep p-6">
      <div className="flex items-baseline justify-between border-b border-ink pb-3 mb-4">
        <h3 className="serif italic text-[22px] text-ink">Your next pick</h3>
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-blue-brand inline-flex items-center gap-1.5">
          <span className="inline-block w-[6px] h-[6px] rounded-full bg-blue-brand pulse-dot" />
          {totalOpen - remainingOpen} / {totalOpen} predicted
        </span>
      </div>

      {/* Matchup */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center pb-4">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="w-14 h-14 rounded-full overflow-hidden border border-ink shadow-[inset_0_0_0_2px_var(--paper-deep)]">
            <Image
              src={home.flag_url}
              alt={home.name}
              width={56}
              height={56}
              className="object-cover w-full h-full"
            />
          </div>
          <div>
            <div className="serif font-semibold text-[16px] text-ink leading-tight tracking-[-0.015em]">
              {home.name}
            </div>
            <div className="mono text-[10px] text-muted-warm tracking-[0.12em] mt-0.5">
              {home.short_code}
            </div>
          </div>
        </div>

        <div className="text-center">
          {hasScore ? (
            <>
              <div className="serif italic font-semibold text-[30px] text-ink leading-none">
                {currentScore!.home} – {currentScore!.away}
              </div>
              <div className="mono text-[9px] uppercase tracking-[0.14em] text-good font-semibold mt-1.5">
                Predicted
              </div>
            </>
          ) : (
            <>
              <div className="serif italic text-[30px] text-ink leading-none font-normal">
                vs.
              </div>
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-muted-warm mt-1.5">
                {format(new Date(match.kickoff_at), "EEE · d MMM")}
              </div>
            </>
          )}
          <div className="mono text-[9px] uppercase tracking-[0.14em] text-blue-brand font-semibold mt-1">
            {stageLabel}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="w-14 h-14 rounded-full overflow-hidden border border-ink shadow-[inset_0_0_0_2px_var(--paper-deep)]">
            <Image
              src={away.flag_url}
              alt={away.name}
              width={56}
              height={56}
              className="object-cover w-full h-full"
            />
          </div>
          <div>
            <div className="serif font-semibold text-[16px] text-ink leading-tight tracking-[-0.015em]">
              {away.name}
            </div>
            <div className="mono text-[10px] text-muted-warm tracking-[0.12em] mt-0.5">
              {away.short_code}
            </div>
          </div>
        </div>
      </div>

      <Link
        href="/predictions"
        className="block w-full text-center bg-blue-brand text-white py-3 font-bold text-[12px] tracking-[0.16em] uppercase hover:bg-blue-bright transition-colors"
      >
        {hasScore ? "Edit prediction" : "Predict score"} &rarr;
      </Link>
    </div>
  );
}
