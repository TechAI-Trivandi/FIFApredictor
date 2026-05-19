"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { format, isSameDay } from "date-fns";
import { Save, Check } from "lucide-react";
import { getTBDLabel, getMatchStageNumber } from "@/lib/bracket-labels";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import type { Match, Prediction, PredictionChoice, Team, StageLock } from "@/lib/types";

type EnrichedMatch = Match & { home_team: Team | null; away_team: Team | null };

interface DraftEntry {
  prediction?: PredictionChoice;
  score_home?: number | null;
  score_away?: number | null;
}

export type CrowdMap = Record<number, { home: number; draw: number; away: number; total: number }>;

interface Props {
  matches: EnrichedMatch[];
  predictions: Record<number, Prediction>;
  stageLocks: Record<string, StageLock>;
  userId: string;
  crowd: CrowdMap;
}

const MIN_CROWD_SAMPLE = 5; // require at least 5 picks before showing %

export function PredictionsList({ matches, predictions, stageLocks, userId, crowd }: Props) {
  const [savedPredictions, setSavedPredictions] = useState(predictions);
  const [drafts, setDrafts] = useState<Record<number, DraftEntry>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const supabase = createClient();

  // Stages that have matches
  const stages = STAGE_ORDER.filter((s) => matches.some((m) => m.stage === s));
  const firstOpenStage = stages.find((s) => {
    const lock = stageLocks[s];
    return lock && lock.predictions_open && !lock.locked;
  });
  const [activeStage, setActiveStage] = useState<string>(firstOpenStage ?? stages[0] ?? "group");

  // Days within the active stage
  const stageMatches = matches.filter((m) => m.stage === activeStage);
  const stageLock = stageLocks[activeStage];
  const stageOpen = !!(stageLock && stageLock.predictions_open && !stageLock.locked);
  const stageHasTBD = stageMatches.some((m) => !m.home_team_id || !m.away_team_id);

  // Group days by date
  const days: { date: Date; key: string; label: string; matches: EnrichedMatch[]; pickedCount: number }[] = [];
  for (const m of stageMatches) {
    const d = new Date(m.kickoff_at);
    const key = format(d, "yyyy-MM-dd");
    let day = days.find((dd) => dd.key === key);
    if (!day) {
      day = { date: d, key, label: format(d, "EEEE"), matches: [], pickedCount: 0 };
      days.push(day);
    }
    day.matches.push(m);
    if (savedPredictions[m.id] || drafts[m.id]?.prediction) day.pickedCount++;
  }

  const [activeDayKey, setActiveDayKey] = useState<string | null>(days[0]?.key ?? null);

  // Reset day when stage changes
  useEffect(() => {
    setActiveDayKey(days[0]?.key ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStage]);

  // Warn on unsaved
  useEffect(() => {
    const hasUnsaved = Object.keys(drafts).length > 0;
    if (!hasUnsaved) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [drafts]);

  function getCurrentPick(matchId: number): PredictionChoice | undefined {
    return drafts[matchId]?.prediction ?? savedPredictions[matchId]?.prediction;
  }
  function getCurrentScore(matchId: number): { h: number | null; a: number | null } {
    const draft = drafts[matchId];
    if (draft && (draft.score_home != null || draft.score_away != null)) {
      return { h: draft.score_home ?? null, a: draft.score_away ?? null };
    }
    const saved = savedPredictions[matchId];
    return { h: saved?.score_home ?? null, a: saved?.score_away ?? null };
  }
  function isDraft(matchId: number): boolean {
    return drafts[matchId] !== undefined;
  }

  function handlePick(matchId: number, choice: PredictionChoice) {
    setSaveStatus("idle");
    const saved = savedPredictions[matchId];
    setDrafts((prev) => {
      const next = { ...prev };
      if (saved && saved.prediction === choice && next[matchId] && !next[matchId].score_home && !next[matchId].score_away) {
        // Reverting to saved value with no score draft → drop the draft
        delete next[matchId];
        return next;
      }
      next[matchId] = { ...(next[matchId] ?? {}), prediction: choice };
      return next;
    });
  }

  function handleScore(matchId: number, side: "h" | "a", n: number) {
    setSaveStatus("idle");
    setDrafts((prev) => {
      const next = { ...prev };
      const cur = next[matchId] ?? {};
      const saved = savedPredictions[matchId];
      next[matchId] = {
        prediction: cur.prediction ?? saved?.prediction,
        score_home: side === "h" ? n : cur.score_home ?? saved?.score_home ?? null,
        score_away: side === "a" ? n : cur.score_away ?? saved?.score_away ?? null,
      };
      return next;
    });
  }

  async function savePredictions() {
    if (Object.keys(drafts).length === 0) return;
    setSaving(true);

    const rows = Object.entries(drafts).map(([id, d]) => {
      const matchId = Number(id);
      const saved = savedPredictions[matchId];
      return {
        user_id: userId,
        match_id: matchId,
        prediction: (d.prediction ?? saved?.prediction)!,
        score_home: d.score_home ?? saved?.score_home ?? null,
        score_away: d.score_away ?? saved?.score_away ?? null,
      };
    });

    const { error } = await supabase
      .from("predictions")
      .upsert(rows, { onConflict: "user_id,match_id" });

    if (!error) {
      const ns = { ...savedPredictions };
      for (const r of rows) {
        const existing = ns[r.match_id];
        ns[r.match_id] = {
          id: existing?.id ?? 0,
          user_id: userId,
          match_id: r.match_id,
          prediction: r.prediction,
          score_home: r.score_home,
          score_away: r.score_away,
          points_awarded: existing?.points_awarded ?? 0,
          created_at: existing?.created_at ?? new Date().toISOString(),
        };
      }
      setSavedPredictions(ns);
      setDrafts({});
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2200);
    }
    setSaving(false);
  }

  const draftCount = Object.keys(drafts).length;
  const totalSaved = Object.keys(savedPredictions).length;
  const totalMatches = matches.length;
  const completePct = ((totalSaved + draftCount) / totalMatches) * 100;

  return (
    <div className="pb-32">
      {/* Pred progress + stage tabs */}
      <div className="flex items-center gap-6 py-3.5">
        <div className="serif italic font-semibold text-[56px] leading-none tracking-[-0.04em] num text-ink">
          <i>{totalSaved + draftCount}</i>
          <span className="text-[22px] text-muted-warm not-italic mx-1.5">/</span>
          <u className="text-muted-warm italic no-underline">{totalMatches}</u>
        </div>
        <div className="flex-1">
          <div className="flex justify-between mono text-[10px] uppercase tracking-[0.16em] text-muted-warm">
            <span>Picks complete</span>
            <span>{Math.round(completePct)}%</span>
          </div>
          <div className="h-[3px] bg-paper-deep mt-2">
            <div className="h-full bg-blue-brand transition-[width] duration-500" style={{ width: `${completePct}%` }} />
          </div>
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-0 border-t border-b border-ink mt-2 overflow-x-auto">
        {stages.map((stage) => {
          const sl = stageLocks[stage];
          const isOpen = sl && sl.predictions_open && !sl.locked;
          const isActive = activeStage === stage;
          const stageMatchIds = matches.filter((m) => m.stage === stage).map((m) => m.id);
          const stagePicked = stageMatchIds.filter(
            (id) => savedPredictions[id] || drafts[id]?.prediction
          ).length;
          return (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={`flex-1 min-w-[120px] px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.18em] border-r border-line last:border-r-0 inline-flex items-center justify-center gap-2 ${
                isActive ? "bg-ink text-paper" : "bg-transparent text-muted-warm hover:bg-paper-deep hover:text-ink"
              }`}
            >
              {STAGE_LABELS[stage]}
              {isOpen && (
                <span className="inline-block w-[5px] h-[5px] rounded-full bg-blue-brand pulse-dot" />
              )}
              <span
                className={`mono text-[9px] px-1.5 py-px ${
                  isActive ? "bg-white/18 text-white/85" : "bg-black/[0.06] text-ink"
                }`}
              >
                {stagePicked}/{stageMatchIds.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day scrubber */}
      {days.length > 0 && (
        <div className="flex gap-1.5 mt-5 mb-4 overflow-x-auto pb-1">
          {days.map((d) => {
            const isActive = activeDayKey === d.key;
            const isPast = d.date < new Date(new Date().toDateString());
            return (
              <button
                key={d.key}
                onClick={() => setActiveDayKey(d.key)}
                className={`flex-shrink-0 min-w-[78px] border px-3.5 py-2.5 text-center transition-colors ${
                  isActive
                    ? "bg-ink text-paper border-ink"
                    : "border-line bg-transparent hover:bg-paper-deep"
                }`}
              >
                <div
                  className={`mono text-[9px] uppercase tracking-[0.16em] ${
                    isActive ? "text-paper/70" : "text-muted-warm"
                  }`}
                >
                  {format(d.date, "EEE")}
                </div>
                <div
                  className={`serif font-semibold text-[26px] tracking-[-0.03em] leading-none mt-1 ${
                    isPast ? "text-muted-warm" : ""
                  }`}
                >
                  {format(d.date, "d")}
                </div>
                <div
                  className={`mono text-[10px] mt-1 ${
                    isActive ? "text-paper/70" : "text-muted-warm"
                  }`}
                >
                  {d.pickedCount}/{d.matches.length}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Active day section */}
      {activeDayKey && (() => {
        const day = days.find((d) => d.key === activeDayKey);
        if (!day) return null;

        return (
          <div className="pt-5 pb-1">
            <div className="flex justify-between items-baseline pb-3 border-b border-ink">
              <h3 className="serif font-semibold text-[32px] leading-none tracking-[-0.02em]">
                {day.label}{" "}
                <i className="font-normal text-muted-warm">· {format(day.date, "d MMMM")}</i>
              </h3>
              <div className="mono text-[11px] uppercase tracking-[0.06em] text-muted-warm">
                <b className="serif italic font-semibold text-[18px] tracking-[-0.01em] text-ink not-italic">
                  <span className="italic">{day.pickedCount}</span>
                </b>{" "}
                / {day.matches.length} picked
              </div>
            </div>

            {!stageOpen && stageHasTBD && (
              <div className="mt-4 px-4 py-3 border border-line-soft text-sm text-muted-warm serif italic">
                Teams not yet determined — opens once previous stage finalises.
              </div>
            )}
            {!stageOpen && !stageHasTBD && (
              <div className="mt-4 px-4 py-3 border border-line-soft text-sm text-muted-warm serif italic">
                Predictions are locked for this stage.
              </div>
            )}

            {day.matches.map((m) => {
              const stageNum = getMatchStageNumber(m.match_number, m.stage);
              const homeFallback = getTBDLabel(m.stage, stageNum, "home");
              const awayFallback = getTBDLabel(m.stage, stageNum, "away");
              const pick = getCurrentPick(m.id);
              const score = getCurrentScore(m.id);
              const draft = isDraft(m.id);
              const savedAt = savedPredictions[m.id]?.created_at
                ? format(new Date(savedPredictions[m.id]!.created_at), "d MMM HH:mm")
                : null;
              const canPredict = stageOpen && m.home_team_id && m.away_team_id;
              const c = crowd[m.id];
              const showCrowd = !!c && c.total >= MIN_CROWD_SAMPLE;

              return (
                <div
                  key={m.id}
                  className={`grid grid-cols-[90px_1fr] gap-7 py-5 border-b border-line transition-colors ${
                    draft ? "bg-blue-brand/[0.045] border-b-blue-brand -mx-5 px-5" : "hover:bg-paper-deep/40 hover:-mx-5 hover:px-5"
                  }`}
                >
                  <div className="pt-1">
                    <div className="serif font-semibold text-[28px] leading-none tracking-[-0.025em]">
                      {m.kickoff_at ? format(new Date(m.kickoff_at), "HH").padStart(2, "0") : "--"}
                      <i className="font-normal text-blue-brand">:</i>
                      {m.kickoff_at ? format(new Date(m.kickoff_at), "mm") : "--"}
                    </div>
                    <div className="inline-block mt-2 mono text-[9px] px-1.5 py-0.5 bg-paper-deep tracking-[0.1em] uppercase font-semibold">
                      {STAGE_LABELS[m.stage]}
                    </div>
                    {showCrowd && (
                      <div className="mt-2 mono text-[9px] text-muted-warm tracking-[0.06em] uppercase">
                        {c.total} {c.total === 1 ? "pick" : "picks"}
                      </div>
                    )}
                  </div>

                  <div>
                    {/* Pick tiles */}
                    <div className="grid grid-cols-3 gap-2">
                      <PickTile
                        team={m.home_team}
                        fallback={homeFallback}
                        active={pick === "home"}
                        draft={draft && pick === "home"}
                        disabled={!canPredict || saving}
                        onClick={() => handlePick(m.id, "home")}
                        crowdLabel="HOME"
                        crowdPct={showCrowd ? c.home : null}
                      />
                      <PickTile
                        draw
                        active={pick === "draw"}
                        draft={draft && pick === "draw"}
                        disabled={!canPredict || saving}
                        onClick={() => handlePick(m.id, "draw")}
                        crowdLabel="DRAW"
                        crowdPct={showCrowd ? c.draw : null}
                      />
                      <PickTile
                        team={m.away_team}
                        fallback={awayFallback}
                        active={pick === "away"}
                        draft={draft && pick === "away"}
                        disabled={!canPredict || saving}
                        onClick={() => handlePick(m.id, "away")}
                        crowdLabel="AWAY"
                        crowdPct={showCrowd ? c.away : null}
                      />
                    </div>

                    {/* Score picker */}
                    {pick && canPredict && m.home_team && m.away_team && (
                      <ScorePicker
                        homeCode={m.home_team.short_code}
                        awayCode={m.away_team.short_code}
                        scoreH={score.h}
                        scoreA={score.a}
                        draft={draft}
                        onSet={(side, n) => handleScore(m.id, side, n)}
                      />
                    )}

                    {/* Foot */}
                    <div className="mt-3 flex justify-between items-center mono text-[10px] uppercase tracking-[0.06em] text-muted-warm">
                      <span>
                        {draft && <span className="text-blue-brand">● Draft — not saved</span>}
                        {!draft && savedAt && (
                          <span className="text-good">✓ Saved · {savedAt}</span>
                        )}
                        {!draft && !savedAt && !pick && <span>○ No pick yet</span>}
                      </span>
                      <span>
                        {pick && (
                          <>
                            {score.h != null && score.a != null ? (
                              <b className="text-ink">+5 if exact · +2 outcome</b>
                            ) : (
                              <>
                                You picked{" "}
                                <b className="text-ink">
                                  {pick === "home"
                                    ? m.home_team?.short_code ?? homeFallback
                                    : pick === "away"
                                    ? m.away_team?.short_code ?? awayFallback
                                    : "Draw"}
                                </b>{" "}
                                · +2 PTS
                              </>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Save bar */}
      {(draftCount > 0 || saveStatus === "saved") && (
        <div className="sticky bottom-3.5 mt-8 bg-ink text-paper px-6 py-4 flex items-center justify-between shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)] z-10">
          <div>
            {saveStatus === "saved" ? (
              <span className="serif font-semibold text-[18px] tracking-[-0.01em] inline-flex items-center gap-2">
                <Check className="w-4 h-4" /> Predictions saved
              </span>
            ) : (
              <>
                <b className="serif font-semibold text-[18px] tracking-[-0.01em]">
                  {draftCount} unsaved {draftCount === 1 ? "pick" : "picks"}
                </b>
                <small className="block text-paper/60 mono text-[10px] tracking-[0.1em] uppercase mt-1">
                  {totalSaved}/{totalMatches} saved · ⌘ S to save
                </small>
              </>
            )}
          </div>
          {draftCount > 0 && (
            <button
              onClick={savePredictions}
              disabled={saving}
              className="bg-blue-brand text-white border-0 px-6 py-3 font-bold text-[12px] tracking-[0.16em] uppercase hover:bg-blue-bright transition-colors disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save predictions"}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PickTile({
  team,
  fallback,
  draw,
  active,
  draft,
  disabled,
  onClick,
  crowdLabel,
  crowdPct,
}: {
  team?: Team | null;
  fallback?: string;
  draw?: boolean;
  active: boolean;
  draft: boolean;
  disabled: boolean;
  onClick: () => void;
  crowdLabel: "HOME" | "DRAW" | "AWAY";
  crowdPct: number | null;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-3.5 flex flex-col gap-2 border text-left transition-colors ${
        active
          ? "bg-ink text-paper border-ink"
          : draft
          ? "bg-paper border-blue-brand shadow-[inset_0_0_0_1px_var(--blue)]"
          : "border-ink hover:bg-paper-deep"
      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className="flex items-center gap-2.5">
        {draw ? (
          <div className="w-8 h-8 grid place-items-center border border-dashed border-current serif italic text-[22px] font-normal">
            ×
          </div>
        ) : team ? (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-current/20 shrink-0">
            <Image
              src={team.flag_url}
              alt={team.name}
              width={32}
              height={32}
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-current/10 border border-dashed border-current/40" />
        )}
        <div className="min-w-0">
          <div
            className={`serif font-semibold text-[16px] leading-tight tracking-[-0.015em] truncate ${
              draw && !active ? "italic font-normal text-muted-warm" : ""
            }`}
          >
            {draw ? "Draw" : team?.name ?? fallback ?? "TBD"}
          </div>
          <div
            className={`mono text-[10px] tracking-[0.08em] mt-0.5 ${
              active ? "text-paper/55" : "text-muted-warm"
            }`}
          >
            {draw ? "DRW" : team?.short_code ?? fallback ?? ""}
          </div>
        </div>
      </div>

      {crowdPct !== null && (
        <div className="mt-auto pt-2.5">
          <div
            className={`flex justify-between items-baseline mono text-[10px] tracking-[0.04em] ${
              active ? "text-paper/55" : "text-muted-warm"
            }`}
          >
            <span>{crowdLabel}</span>
            <b
              className={`serif italic font-semibold text-[16px] tracking-[-0.01em] ${
                active ? "text-paper" : "text-ink"
              }`}
            >
              {crowdPct}%
            </b>
          </div>
          <div
            className={`h-[2px] mt-1.5 overflow-hidden ${
              active ? "bg-paper/18" : "bg-paper-deep"
            }`}
          >
            <div
              className={`h-full transition-[width] duration-500 ${
                active ? "bg-blue-bright" : "bg-ink"
              }`}
              style={{ width: `${crowdPct}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

function ScorePicker({
  homeCode,
  awayCode,
  scoreH,
  scoreA,
  draft,
  onSet,
}: {
  homeCode: string;
  awayCode: string;
  scoreH: number | null;
  scoreA: number | null;
  draft: boolean;
  onSet: (side: "h" | "a", n: number) => void;
}) {
  const hasScore = scoreH != null && scoreA != null;
  return (
    <div
      className={`mt-3.5 px-3.5 py-3 border ${
        draft ? "border-blue-brand bg-blue-brand/[0.04]" : "border-dashed border-line bg-white/40"
      }`}
    >
      <div className="flex justify-between items-baseline mb-2.5 mono text-[9px] uppercase tracking-[0.18em] text-muted-warm">
        <span>
          Predict exact score{" "}
          <span className="text-blue-brand font-bold">+5 PTS</span>
        </span>
        <span className="serif italic font-semibold text-[16px] tracking-[-0.01em] text-ink not-italic">
          {hasScore ? (
            <span className="italic">
              {homeCode} {scoreH}
              <span className="text-muted-warm mx-1.5">–</span>
              {scoreA} {awayCode}
            </span>
          ) : (
            <span className="mono text-[10px] not-italic text-muted-warm">
              OPTIONAL · +2 FOR OUTCOME
            </span>
          )}
        </span>
      </div>
      {(["h", "a"] as const).map((side) => {
        const code = side === "h" ? homeCode : awayCode;
        const value = side === "h" ? scoreH : scoreA;
        return (
          <div key={side} className="grid grid-cols-[70px_1fr] gap-2.5 items-center mb-1.5 last:mb-0">
            <span className="mono text-[10px] tracking-[0.1em] font-semibold text-muted-warm">
              {code}
            </span>
            <div className="grid grid-cols-7 gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => onSet(side, n)}
                  className={`py-1.5 border serif font-semibold text-[14px] tracking-[-0.01em] transition-colors ${
                    value === n
                      ? "bg-ink text-paper border-ink"
                      : "border-line hover:bg-paper-deep"
                  }`}
                >
                  {n === 6 ? "6+" : n}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
