"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Save, Check, Pencil, Lock } from "lucide-react";
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

const MIN_CROWD_SAMPLE = 5;
const LOCK_HOURS = 24; // lock predictions this many hours before kickoff

function deriveOutcome(h: number, a: number): PredictionChoice {
  if (h > a) return "home";
  if (a > h) return "away";
  return "draw";
}

function outcomeLabel(p: PredictionChoice): string {
  if (p === "home") return "Home win";
  if (p === "away") return "Away win";
  return "Draw";
}

function isMatchLocked(kickoffAt: string): boolean {
  return new Date(kickoffAt).getTime() - Date.now() < LOCK_HOURS * 60 * 60 * 1000;
}

function hasSavedScore(p: Prediction | undefined): boolean {
  return !!(p && p.score_home != null && p.score_away != null);
}

export function PredictionsList({ matches, predictions, stageLocks, userId, crowd }: Props) {
  const [savedPredictions, setSavedPredictions] = useState(predictions);
  const [drafts, setDrafts] = useState<Record<number, DraftEntry>>({});
  const [editingIds, setEditingIds] = useState<Set<number>>(new Set());
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
    if (hasSavedScore(savedPredictions[m.id]) || (drafts[m.id]?.score_home != null && drafts[m.id]?.score_away != null)) {
      day.pickedCount++;
    }
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

  function handleScore(matchId: number, side: "h" | "a", n: number) {
    setSaveStatus("idle");
    setDrafts((prev) => {
      const next = { ...prev };
      const cur = next[matchId] ?? {};
      const saved = savedPredictions[matchId];
      const newHome = side === "h" ? n : cur.score_home ?? saved?.score_home ?? null;
      const newAway = side === "a" ? n : cur.score_away ?? saved?.score_away ?? null;

      // Auto-derive outcome from score
      let prediction: PredictionChoice | undefined = cur.prediction ?? saved?.prediction;
      if (newHome != null && newAway != null) {
        prediction = deriveOutcome(newHome, newAway);
      }

      next[matchId] = { prediction, score_home: newHome, score_away: newAway };
      return next;
    });
  }

  function startEditing(matchId: number) {
    setEditingIds((prev) => new Set(prev).add(matchId));
    // Pre-fill draft with saved values so the picker shows current selection
    const saved = savedPredictions[matchId];
    if (saved) {
      setDrafts((prev) => ({
        ...prev,
        [matchId]: {
          prediction: saved.prediction,
          score_home: saved.score_home,
          score_away: saved.score_away,
        },
      }));
    }
  }

  function cancelEditing(matchId: number) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(matchId);
      return next;
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }

  async function savePredictions() {
    if (Object.keys(drafts).length === 0) return;
    setSaving(true);

    // Only save drafts that have both scores
    const rows = Object.entries(drafts)
      .filter(([, d]) => d.score_home != null && d.score_away != null)
      .map(([id, d]) => ({
        user_id: userId,
        match_id: Number(id),
        prediction: deriveOutcome(d.score_home!, d.score_away!),
        score_home: d.score_home!,
        score_away: d.score_away!,
      }));

    if (rows.length === 0) {
      setSaving(false);
      return;
    }

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
      setEditingIds(new Set());
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2200);
    }
    setSaving(false);
  }

  const draftCount = Object.entries(drafts).filter(
    ([, d]) => d.score_home != null && d.score_away != null
  ).length;
  const incompleteDrafts = Object.keys(drafts).length - draftCount;
  const totalSaved = Object.values(savedPredictions).filter((p) => hasSavedScore(p)).length;
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
            <span>Scores predicted</span>
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
          const stageMatchList = matches.filter((m) => m.stage === stage);
          const stagePicked = stageMatchList.filter(
            (m) => hasSavedScore(savedPredictions[m.id]) || (drafts[m.id]?.score_home != null && drafts[m.id]?.score_away != null)
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
                {stagePicked}/{stageMatchList.length}
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
                / {day.matches.length} predicted
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
              const score = getCurrentScore(m.id);
              const draft = isDraft(m.id);
              const saved = savedPredictions[m.id];
              const savedComplete = hasSavedScore(saved);
              const editing = editingIds.has(m.id);
              const matchLocked = isMatchLocked(m.kickoff_at);
              const canPredict = stageOpen && m.home_team_id && m.away_team_id && !matchLocked;
              const showPicker = canPredict && (!savedComplete || editing || draft);
              const showSaved = savedComplete && !editing && !draft;

              const home = m.home_team;
              const away = m.away_team;
              const savedAt = saved?.created_at
                ? format(new Date(saved.created_at), "d MMM HH:mm")
                : null;

              return (
                <div
                  key={m.id}
                  className={`grid grid-cols-[90px_1fr] gap-7 py-5 border-b border-line transition-colors ${
                    draft ? "bg-blue-brand/[0.045] border-b-blue-brand -mx-5 px-5" : "hover:bg-paper-deep/40 hover:-mx-5 hover:px-5"
                  }`}
                >
                  {/* Left column: time + stage */}
                  <div className="pt-1">
                    <div className="serif font-semibold text-[28px] leading-none tracking-[-0.025em]">
                      {m.kickoff_at ? format(new Date(m.kickoff_at), "HH").padStart(2, "0") : "--"}
                      <i className="font-normal text-blue-brand">:</i>
                      {m.kickoff_at ? format(new Date(m.kickoff_at), "mm") : "--"}
                    </div>
                    <div className="inline-block mt-2 mono text-[9px] px-1.5 py-0.5 bg-paper-deep tracking-[0.1em] uppercase font-semibold">
                      {STAGE_LABELS[m.stage]}
                    </div>
                  </div>

                  {/* Right column: match + prediction */}
                  <div>
                    {/* Match header — teams */}
                    <MatchHeader
                      home={home}
                      away={away}
                      homeFallback={homeFallback}
                      awayFallback={awayFallback}
                    />

                    {/* Saved prediction display */}
                    {showSaved && (
                      <SavedPrediction
                        homeCode={home?.short_code ?? homeFallback}
                        awayCode={away?.short_code ?? awayFallback}
                        scoreH={saved!.score_home!}
                        scoreA={saved!.score_away!}
                        savedAt={savedAt!}
                        canEdit={!!canPredict}
                        matchLocked={matchLocked}
                        onEdit={() => startEditing(m.id)}
                      />
                    )}

                    {/* Score picker — visible when predicting or editing */}
                    {showPicker && home && away && (
                      <>
                        <ScorePicker
                          homeCode={home.short_code}
                          awayCode={away.short_code}
                          scoreH={score.h}
                          scoreA={score.a}
                          draft={draft}
                          onSet={(side, n) => handleScore(m.id, side, n)}
                        />
                        {editing && (
                          <button
                            onClick={() => cancelEditing(m.id)}
                            className="mt-2 mono text-[10px] uppercase tracking-[0.12em] text-muted-warm hover:text-ink transition-colors"
                          >
                            Cancel edit
                          </button>
                        )}
                      </>
                    )}

                    {/* Locked message for matches with no prediction */}
                    {!showSaved && !showPicker && matchLocked && stageOpen && (
                      <div className="mt-3 flex items-center gap-2 px-3.5 py-3 border border-line-soft bg-paper-deep/50">
                        <Lock className="w-3.5 h-3.5 text-muted-warm" />
                        <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted-warm">
                          Predictions closed — locks 24h before kickoff
                        </span>
                      </div>
                    )}

                    {/* No teams yet */}
                    {!home && !away && stageOpen && (
                      <div className="mt-3 mono text-[10px] uppercase tracking-[0.12em] text-muted-warm">
                        Teams TBD
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-3 flex justify-between items-center mono text-[10px] uppercase tracking-[0.06em] text-muted-warm">
                      <span>
                        {draft && score.h != null && score.a != null && (
                          <span className="text-blue-brand">● Draft — not saved</span>
                        )}
                        {draft && (score.h == null || score.a == null) && (
                          <span className="text-blue-brand">Pick scores for both teams</span>
                        )}
                        {!draft && !showSaved && !matchLocked && canPredict && (
                          <span>Predict the score</span>
                        )}
                      </span>
                      <span>
                        {(draft || showPicker) && score.h != null && score.a != null && (
                          <b className="text-ink">
                            {home?.short_code ?? homeFallback} {score.h} – {score.a} {away?.short_code ?? awayFallback}
                            <span className="text-muted-warm font-normal ml-2">
                              ({outcomeLabel(deriveOutcome(score.h, score.a))})
                            </span>
                          </b>
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
      {(draftCount > 0 || incompleteDrafts > 0 || saveStatus === "saved") && (
        <div className="sticky bottom-3.5 mt-8 bg-ink text-paper px-6 py-4 flex items-center justify-between shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)] z-10">
          <div>
            {saveStatus === "saved" ? (
              <span className="serif font-semibold text-[18px] tracking-[-0.01em] inline-flex items-center gap-2">
                <Check className="w-4 h-4" /> Predictions saved
              </span>
            ) : (
              <>
                <b className="serif font-semibold text-[18px] tracking-[-0.01em]">
                  {draftCount > 0
                    ? `${draftCount} unsaved ${draftCount === 1 ? "prediction" : "predictions"}`
                    : `${incompleteDrafts} incomplete — pick both scores`}
                </b>
                <small className="block text-paper/60 mono text-[10px] tracking-[0.1em] uppercase mt-1">
                  {totalSaved}/{totalMatches} saved
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

/* ── Match Header ───────────────────────────────────────────── */
function MatchHeader({
  home,
  away,
  homeFallback,
  awayFallback,
}: {
  home: Team | null;
  away: Team | null;
  homeFallback: string;
  awayFallback: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-3">
      {/* Home team */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {home ? (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-ink/20 shrink-0">
            <Image src={home.flag_url} alt={home.name} width={32} height={32} className="object-cover w-full h-full" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-paper-deep border border-dashed border-line shrink-0" />
        )}
        <div className="min-w-0">
          <div className="serif font-semibold text-[16px] leading-tight tracking-[-0.015em] truncate">
            {home?.name ?? homeFallback}
          </div>
          <div className="mono text-[10px] tracking-[0.08em] text-muted-warm mt-0.5">
            {home?.short_code ?? homeFallback}
          </div>
        </div>
      </div>

      {/* vs */}
      <div className="serif italic text-[18px] text-muted-warm font-normal px-2">vs</div>

      {/* Away team */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end text-right">
        <div className="min-w-0">
          <div className="serif font-semibold text-[16px] leading-tight tracking-[-0.015em] truncate">
            {away?.name ?? awayFallback}
          </div>
          <div className="mono text-[10px] tracking-[0.08em] text-muted-warm mt-0.5">
            {away?.short_code ?? awayFallback}
          </div>
        </div>
        {away ? (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-ink/20 shrink-0">
            <Image src={away.flag_url} alt={away.name} width={32} height={32} className="object-cover w-full h-full" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-paper-deep border border-dashed border-line shrink-0" />
        )}
      </div>
    </div>
  );
}

/* ── Saved Prediction Card ──────────────────────────────────── */
function SavedPrediction({
  homeCode,
  awayCode,
  scoreH,
  scoreA,
  savedAt,
  canEdit,
  matchLocked,
  onEdit,
}: {
  homeCode: string;
  awayCode: string;
  scoreH: number;
  scoreA: number;
  savedAt: string;
  canEdit: boolean;
  matchLocked: boolean;
  onEdit: () => void;
}) {
  const outcome = deriveOutcome(scoreH, scoreA);
  return (
    <div className="border border-good/40 bg-good/[0.06] px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="serif italic font-semibold text-[26px] tracking-[-0.02em] text-ink leading-none">
            {homeCode}{" "}
            <span className="text-[30px]">{scoreH}</span>
            <span className="text-muted-warm mx-1.5 text-[22px] font-normal">–</span>
            <span className="text-[30px]">{scoreA}</span>
            {" "}{awayCode}
          </div>
          <div className="mono text-[9px] uppercase tracking-[0.14em] px-2 py-1 bg-ink text-paper font-semibold">
            {outcomeLabel(outcome)}
          </div>
        </div>

        {canEdit && !matchLocked ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.12em] text-muted-warm hover:text-ink transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        ) : matchLocked ? (
          <div className="flex items-center gap-1.5 mono text-[9px] uppercase tracking-[0.12em] text-muted-warm">
            <Lock className="w-3 h-3" />
            Locked
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.06em] text-good">
        <Check className="w-3.5 h-3.5" />
        Predicted · {savedAt}
        <span className="text-muted-warm ml-2">+5 if exact · +2 if result correct</span>
      </div>
    </div>
  );
}

/* ── Score Picker ───────────────────────────────────────────── */
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
      className={`mt-3 px-3.5 py-3 border ${
        draft ? "border-blue-brand bg-blue-brand/[0.04]" : "border-line bg-white/40"
      }`}
    >
      <div className="flex justify-between items-baseline mb-2.5 mono text-[9px] uppercase tracking-[0.18em] text-muted-warm">
        <span>
          Predict the score
        </span>
        <span>
          {hasScore ? (
            <span className="text-ink font-bold">
              +5 exact · +2 result
            </span>
          ) : (
            <span>
              Pick both teams
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
