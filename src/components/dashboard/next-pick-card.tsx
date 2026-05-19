"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { STAGE_LABELS } from "@/lib/constants";
import type { Match, PredictionChoice, Team } from "@/lib/types";

type EnrichedMatch = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

interface Props {
  match: EnrichedMatch | null;
  currentPick: PredictionChoice | null;
  remainingOpen: number;
  totalOpen: number;
  userId: string;
  crowd?: { home: number; draw: number; away: number; total: number } | null;
}

const MIN_CROWD_SAMPLE = 5;

export function NextPickCard({ match, currentPick, remainingOpen, totalOpen, userId, crowd }: Props) {
  const [pick, setPick] = useState<PredictionChoice | null>(currentPick);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

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

  async function handlePick(choice: PredictionChoice) {
    if (saving) return;
    setSaving(true);
    setPick(choice);

    if (currentPick) {
      await supabase
        .from("predictions")
        .update({ prediction: choice })
        .eq("user_id", userId)
        .eq("match_id", match!.id);
    } else {
      await supabase
        .from("predictions")
        .insert({ user_id: userId, match_id: match!.id, prediction: choice });
    }
    setSaving(false);
  }

  const stageLabel = STAGE_LABELS[match.stage] ?? match.stage;
  const home = match.home_team;
  const away = match.away_team;

  return (
    <div className="border border-ink bg-paper-deep p-6">
      <div className="flex items-baseline justify-between border-b border-ink pb-3 mb-4">
        <h3 className="serif italic text-[22px] text-ink">Your next pick</h3>
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-blue-brand inline-flex items-center gap-1.5">
          <span className="inline-block w-[6px] h-[6px] rounded-full bg-blue-brand pulse-dot" />
          {totalOpen - remainingOpen} / {totalOpen} open
        </span>
      </div>

      {/* Matchup */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center pb-4">
        <Link
          href="/predictions"
          className="flex flex-col items-center gap-2.5 text-center transition-transform hover:-translate-y-0.5"
        >
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
              {match.group_letter && ` · ${match.group_letter}1`}
            </div>
          </div>
        </Link>

        <div className="text-center">
          <div className="serif italic text-[30px] text-ink leading-none font-normal">
            vs.
          </div>
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-muted-warm mt-1.5">
            {format(new Date(match.kickoff_at), "EEE · d MMM")}
          </div>
          <div className="mono text-[9px] uppercase tracking-[0.14em] text-blue-brand font-semibold mt-1">
            {stageLabel}
          </div>
        </div>

        <Link
          href="/predictions"
          className="flex flex-col items-center gap-2.5 text-center transition-transform hover:-translate-y-0.5"
        >
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
        </Link>
      </div>

      {/* Pick options */}
      <div className="grid grid-cols-3 gap-1.5">
        <PickButton
          label={home.short_code}
          active={pick === "home"}
          disabled={saving}
          onClick={() => handlePick("home")}
          crowdPct={crowd && crowd.total >= MIN_CROWD_SAMPLE ? crowd.home : null}
        />
        <PickButton
          label="Draw"
          active={pick === "draw"}
          disabled={saving}
          onClick={() => handlePick("draw")}
          crowdPct={crowd && crowd.total >= MIN_CROWD_SAMPLE ? crowd.draw : null}
        />
        <PickButton
          label={away.short_code}
          active={pick === "away"}
          disabled={saving}
          onClick={() => handlePick("away")}
          crowdPct={crowd && crowd.total >= MIN_CROWD_SAMPLE ? crowd.away : null}
        />
      </div>

      <Link
        href="/predictions"
        className="mt-4 mono text-[10px] uppercase tracking-[0.16em] text-muted-warm hover:text-ink inline-block transition-colors"
      >
        Add exact score for +5 pts &rarr;
      </Link>
    </div>
  );
}

function PickButton({
  label,
  active,
  disabled,
  onClick,
  crowdPct,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  crowdPct: number | null;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-3 text-left flex flex-col gap-1 border border-ink transition-colors ${
        active ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-paper"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.06em]">{label}</span>
      <span className={`mono text-[10px] ${active ? "text-paper/55" : "text-muted-warm"}`}>
        {crowdPct !== null ? `${crowdPct}% picked` : "Quick pick"}
      </span>
    </button>
  );
}
