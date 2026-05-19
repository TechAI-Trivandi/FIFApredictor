"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"predict" | "my">("predict");
  const [savedPredictions, setSavedPredictions] = useState(predictions);
  const [drafts, setDrafts] = useState<Record<number, DraftEntry>>({});
  const [editingIds, setEditingIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const supabase = createClient();

  // Sync server data into client state when the page re-renders with fresh props
  // (e.g. after router.refresh() or navigation)
  useEffect(() => {
    setSavedPredictions(predictions);
  }, [predictions]);

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
      // Re-fetch predictions client-side for immediate UI update
      // (the DB trigger scores immediately if the match is already finished)
      const { data: freshPredictions } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", userId);

      const ns: Record<number, Prediction> = {};
      freshPredictions?.forEach((p) => {
        ns[p.match_id] = p;
      });
      setSavedPredictions(ns);
      setDrafts({});
      setEditingIds(new Set());
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2200);

      // Also refresh the server component data (crowd stats, match statuses, etc.)
      startTransition(() => {
        router.refresh();
      });
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

  // My Predictions: build summary data
  const myPredictions = matches
    .filter((m) => hasSavedScore(savedPredictions[m.id]))
    .map((m) => ({
      match: m,
      prediction: savedPredictions[m.id]!,
    }))
    .sort((a, b) => new Date(a.match.kickoff_at).getTime() - new Date(b.match.kickoff_at).getTime());

  const myTotalPoints = myPredictions.reduce((sum, p) => sum + p.prediction.points_awarded, 0);
  const myCorrect = myPredictions.filter((p) => p.prediction.points_awarded > 0).length;
  const myFinished = myPredictions.filter((p) => p.match.status === "finished").length;

  return (
    <div className="pb-32">
      {/* Tab toggle */}
      <div className="flex gap-0 border border-ink mt-4 mb-2 w-fit">
        <button
          onClick={() => setTab("predict")}
          className={`px-5 py-2.5 mono text-[10px] font-bold tracking-[0.18em] uppercase transition-colors border-r border-ink ${
            tab === "predict" ? "bg-ink text-paper" : "bg-transparent text-muted-warm hover:bg-paper-deep hover:text-ink"
          }`}
        >
          Predict
        </button>
        <button
          onClick={() => setTab("my")}
          className={`px-5 py-2.5 mono text-[10px] font-bold tracking-[0.18em] uppercase transition-colors ${
            tab === "my" ? "bg-ink text-paper" : "bg-transparent text-muted-warm hover:bg-paper-deep hover:text-ink"
          }`}
        >
          My predictions
          {totalSaved > 0 && (
            <span className={`ml-2 mono text-[9px] px-1.5 py-px ${tab === "my" ? "bg-white/18 text-white/85" : "bg-paper-deep text-ink"}`}>
              {totalSaved}
            </span>
          )}
        </button>
      </div>

      {/* ═══ MY PREDICTIONS TAB ═══ */}
      {tab === "my" && (
        <MyPredictionsView
          predictions={myPredictions}
          totalPoints={myTotalPoints}
          correctCount={myCorrect}
          finishedCount={myFinished}
        />
      )}

      {/* ═══ PREDICT TAB ═══ */}
      {tab === "predict" && <>
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
              className={`flex-1 min-w-[90px] sm:min-w-[120px] px-3 sm:px-4 py-3 sm:py-3.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.18em] border-r border-line last:border-r-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 ${
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
                  className={`py-5 border-b border-line transition-colors ${
                    draft ? "bg-blue-brand/[0.045] border-b-blue-brand -mx-5 px-5" : "hover:bg-paper-deep/40 hover:-mx-5 hover:px-5"
                  }`}
                >
                  {/* Mobile: inline time + stage */}
                  <div className="sm:hidden flex items-center gap-2.5 mb-3">
                    <span className="serif font-semibold text-[20px] leading-none tracking-[-0.025em]">
                      {m.kickoff_at ? format(new Date(m.kickoff_at), "HH:mm") : "--:--"}
                    </span>
                    <span className="mono text-[9px] px-1.5 py-0.5 bg-paper-deep tracking-[0.1em] uppercase font-semibold">
                      {STAGE_LABELS[m.stage]}
                    </span>
                  </div>

                  <div className="sm:grid sm:grid-cols-[90px_1fr] sm:gap-7">
                  {/* Left column: time + stage (desktop only) */}
                  <div className="hidden sm:block pt-1">
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
                    {/* Editable: teams with inline score steppers */}
                    {showPicker && home && away && (
                      <div>
                        <MatchRowEditable
                          home={home}
                          away={away}
                          scoreH={score.h}
                          scoreA={score.a}
                          onScore={(side, n) => handleScore(m.id, side, n)}
                        />
                        <div className="mt-2.5 flex justify-between items-center mono text-[10px] uppercase tracking-[0.06em] text-muted-warm">
                          <span>
                            {draft && score.h != null && score.a != null && (
                              <span className="text-blue-brand">● Not saved</span>
                            )}
                            {(!draft || score.h == null || score.a == null) && (
                              <span>+5 exact score · +2 correct result</span>
                            )}
                          </span>
                          <span className="flex items-center gap-3">
                            {score.h != null && score.a != null && (
                              <span className="text-ink font-bold">
                                {outcomeLabel(deriveOutcome(score.h, score.a))}
                              </span>
                            )}
                            {editing && (
                              <button
                                onClick={() => cancelEditing(m.id)}
                                className="text-muted-warm hover:text-ink transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Saved prediction display */}
                    {showSaved && (
                      <SavedPrediction
                        homeCode={home?.short_code ?? homeFallback}
                        awayCode={away?.short_code ?? awayFallback}
                        homeFlag={home?.flag_url}
                        awayFlag={away?.flag_url}
                        homeName={home?.name ?? homeFallback}
                        awayName={away?.name ?? awayFallback}
                        scoreH={saved!.score_home!}
                        scoreA={saved!.score_away!}
                        savedAt={savedAt!}
                        canEdit={!!canPredict}
                        matchLocked={matchLocked}
                        onEdit={() => startEditing(m.id)}
                      />
                    )}

                    {/* Non-editable: just team names (locked or TBD) */}
                    {!showPicker && !showSaved && (
                      <div>
                        <MatchRowStatic
                          home={home}
                          away={away}
                          homeFallback={homeFallback}
                          awayFallback={awayFallback}
                        />
                        {matchLocked && stageOpen && (
                          <div className="mt-2 flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.12em] text-muted-warm">
                            <Lock className="w-3 h-3" />
                            Locked — 24h before kickoff
                          </div>
                        )}
                        {!home && !away && stageOpen && (
                          <div className="mt-2 mono text-[10px] uppercase tracking-[0.12em] text-muted-warm">
                            Teams TBD
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  </div>{/* close sm:grid */}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Save bar */}
      {(draftCount > 0 || incompleteDrafts > 0 || saveStatus === "saved") && (
        <div className="sticky bottom-3.5 mt-8 bg-ink text-paper px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)] z-10">
          <div className="min-w-0">
            {saveStatus === "saved" ? (
              <span className="serif font-semibold text-[15px] sm:text-[18px] tracking-[-0.01em] inline-flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" /> Saved
              </span>
            ) : (
              <>
                <b className="serif font-semibold text-[14px] sm:text-[18px] tracking-[-0.01em]">
                  {draftCount > 0
                    ? `${draftCount} unsaved`
                    : `${incompleteDrafts} incomplete`}
                </b>
                <small className="block text-paper/60 mono text-[10px] tracking-[0.1em] uppercase mt-0.5 sm:mt-1">
                  {totalSaved}/{totalMatches} saved
                </small>
              </>
            )}
          </div>
          {draftCount > 0 && (
            <button
              onClick={savePredictions}
              disabled={saving}
              className="bg-blue-brand text-white border-0 px-4 sm:px-6 py-2.5 sm:py-3 font-bold text-[11px] sm:text-[12px] tracking-[0.16em] uppercase hover:bg-blue-bright transition-colors disabled:opacity-60 shrink-0"
            >
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {saving ? "Saving..." : "Save"}
              </span>
            </button>
          )}
        </div>
      )}
      </>}
    </div>
  );
}

/* ── My Predictions View ────────────────────────────────────── */
function MyPredictionsView({
  predictions,
  totalPoints,
  correctCount,
  finishedCount,
}: {
  predictions: { match: EnrichedMatch; prediction: Prediction }[];
  totalPoints: number;
  correctCount: number;
  finishedCount: number;
}) {
  if (predictions.length === 0) {
    return (
      <div className="mt-12 text-center">
        <div className="serif italic text-[22px] text-muted-warm">No predictions yet.</div>
        <p className="mono text-[11px] uppercase tracking-[0.12em] text-muted-warm mt-3">
          Head to the Predict tab to start picking scores.
        </p>
      </div>
    );
  }

  const accuracy = finishedCount > 0 ? Math.round((correctCount / finishedCount) * 100) : null;

  // Group by stage
  const byStage: Record<string, { match: EnrichedMatch; prediction: Prediction }[]> = {};
  for (const p of predictions) {
    const stage = p.match.stage;
    if (!byStage[stage]) byStage[stage] = [];
    byStage[stage].push(p);
  }

  return (
    <div className="pt-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <div className="border border-ink p-3 sm:p-4">
          <div className="mono text-[8px] sm:text-[9px] font-bold tracking-[0.14em] sm:tracking-[0.18em] uppercase text-muted-warm">Points</div>
          <div className="serif font-semibold text-[28px] sm:text-[36px] leading-none tracking-[-0.03em] mt-1.5 sm:mt-2">{totalPoints}</div>
        </div>
        <div className="border border-ink p-3 sm:p-4">
          <div className="mono text-[8px] sm:text-[9px] font-bold tracking-[0.14em] sm:tracking-[0.18em] uppercase text-muted-warm">Accuracy</div>
          <div className="serif font-semibold text-[28px] sm:text-[36px] leading-none tracking-[-0.03em] mt-1.5 sm:mt-2">
            {accuracy !== null ? `${accuracy}%` : "–"}
          </div>
          {finishedCount > 0 && (
            <div className="mono text-[9px] sm:text-[10px] text-muted-warm mt-1">{correctCount}/{finishedCount}</div>
          )}
        </div>
        <div className="border border-ink p-3 sm:p-4">
          <div className="mono text-[8px] sm:text-[9px] font-bold tracking-[0.14em] sm:tracking-[0.18em] uppercase text-muted-warm">Picks</div>
          <div className="serif font-semibold text-[28px] sm:text-[36px] leading-none tracking-[-0.03em] mt-1.5 sm:mt-2">{predictions.length}</div>
        </div>
      </div>

      {/* Predictions by stage */}
      {STAGE_ORDER.filter((s) => byStage[s]).map((stage) => (
        <div key={stage} className="mb-6">
          <div className="flex items-baseline justify-between border-b border-ink pb-2 mb-3">
            <h3 className="serif font-semibold text-[22px] tracking-[-0.02em]">{STAGE_LABELS[stage]}</h3>
            <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted-warm">
              {byStage[stage].length} {byStage[stage].length === 1 ? "prediction" : "predictions"}
            </span>
          </div>
          <div className="space-y-1.5">
            {byStage[stage].map(({ match: m, prediction: p }) => {
              const home = m.home_team;
              const away = m.away_team;
              const finished = m.status === "finished";
              const correct = p.points_awarded > 0;
              const exact = p.points_awarded === 5;

              return (
                <div
                  key={m.id}
                  className={`px-3 sm:px-4 py-3 border ${
                    finished
                      ? correct
                        ? "border-good/40 bg-good/[0.05]"
                        : "border-bad/30 bg-bad/[0.04]"
                      : "border-line"
                  }`}
                >
                  {/* Main row */}
                  <div className="flex items-center gap-2 sm:gap-3">
                  {/* Date */}
                  <div className="mono text-[10px] text-muted-warm tracking-[0.06em] w-[44px] sm:w-[60px] shrink-0">
                    {format(new Date(m.kickoff_at), "d MMM")}
                  </div>

                  {/* Teams + predicted score */}
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                    {home && <TeamFlag team={home} size={20} />}
                    <span className="mono text-[10px] font-bold tracking-[0.06em] w-[28px] sm:w-[32px]">{home?.short_code ?? "TBD"}</span>
                    <span className="serif font-semibold text-[16px] sm:text-[18px] tracking-[-0.02em] text-ink w-[20px] sm:w-[24px] text-center">
                      {p.score_home}
                    </span>
                    <span className="text-muted-warm text-[12px] sm:text-[14px]">–</span>
                    <span className="serif font-semibold text-[16px] sm:text-[18px] tracking-[-0.02em] text-ink w-[20px] sm:w-[24px] text-center">
                      {p.score_away}
                    </span>
                    <span className="mono text-[10px] font-bold tracking-[0.06em] w-[28px] sm:w-[32px] text-right">{away?.short_code ?? "TBD"}</span>
                    {away && <TeamFlag team={away} size={20} />}
                  </div>

                  {/* Actual result — desktop only inline */}
                  {finished && m.home_score != null && m.away_score != null && (
                    <div className="hidden sm:block mono text-[10px] tracking-[0.06em] text-muted-warm shrink-0 text-right w-[70px]">
                      Actual: {m.home_score}–{m.away_score}
                    </div>
                  )}

                  {/* Points badge */}
                  <div className="shrink-0 w-[36px] sm:w-[52px] text-right">
                    {finished ? (
                      <span
                        className={`inline-block mono text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-1 ${
                          exact
                            ? "bg-good text-white"
                            : correct
                            ? "bg-good/20 text-good"
                            : "bg-bad/15 text-bad"
                        }`}
                      >
                        {exact ? "+5" : correct ? "+2" : "0"}
                      </span>
                    ) : (
                      <span className="mono text-[9px] tracking-[0.1em] uppercase text-muted-warm">
                        Pending
                      </span>
                    )}
                  </div>
                  </div>{/* close main row */}

                  {/* Actual result — mobile only, below main row */}
                  {finished && m.home_score != null && m.away_score != null && (
                    <div className="sm:hidden mono text-[9px] tracking-[0.06em] text-muted-warm mt-1.5 pl-[46px]">
                      Actual: {m.home_score}–{m.away_score}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Team Flag ───────────────────────────────────────────────── */
function TeamFlag({ team, size = 32 }: { team: Team | null; size?: number }) {
  if (!team) return <div className="w-8 h-8 rounded-full bg-paper-deep border border-dashed border-line shrink-0" />;
  return (
    <div className="rounded-full overflow-hidden border border-ink/20 shrink-0" style={{ width: size, height: size }}>
      <Image src={team.flag_url} alt={team.name} width={size} height={size} className="object-cover w-full h-full" />
    </div>
  );
}

/* ── Score Stepper ([-] [input] [+]) ────────────────────────── */
function ScoreStepper({
  value,
  onChange,
  compact = false,
}: {
  value: number | null;
  onChange: (n: number) => void;
  compact?: boolean;
}) {
  const current = value ?? 0;
  const btnCls = compact
    ? "w-8 h-10 border border-line hover:bg-paper-deep flex items-center justify-center text-[16px] text-muted-warm hover:text-ink transition-colors select-none"
    : "w-8 h-10 border border-line hover:bg-paper-deep flex items-center justify-center text-[16px] text-muted-warm hover:text-ink transition-colors select-none";
  const inputCls = compact
    ? "w-11 h-10 border-y border-line bg-transparent text-center serif font-semibold text-[18px] tracking-[-0.02em] text-ink focus:outline-none focus:border-blue-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    : "w-12 h-10 border-y border-line bg-transparent text-center serif font-semibold text-[20px] tracking-[-0.02em] text-ink focus:outline-none focus:border-blue-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, current - 1))}
        className={btnCls}
      >
        −
      </button>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value != null ? value : ""}
        placeholder="–"
        onChange={(e) => {
          const v = parseInt(e.target.value);
          onChange(isNaN(v) ? 0 : Math.max(0, v));
        }}
        className={inputCls}
      />
      <button
        type="button"
        onClick={() => onChange(current + 1)}
        className={btnCls}
      >
        +
      </button>
    </div>
  );
}

/* ── Editable Match Row (teams + score steppers) ────────────── */
function MatchRowEditable({
  home,
  away,
  scoreH,
  scoreA,
  onScore,
}: {
  home: Team;
  away: Team;
  scoreH: number | null;
  scoreA: number | null;
  onScore: (side: "h" | "a", n: number) => void;
}) {
  return (
    <>
      {/* ── Desktop: single row ── */}
      <div className="hidden sm:flex items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <TeamFlag team={home} />
          <div className="min-w-0">
            <div className="serif font-semibold text-[15px] leading-tight tracking-[-0.015em] truncate">
              {home.name}
            </div>
            <div className="mono text-[9px] tracking-[0.08em] text-muted-warm mt-0.5">
              {home.short_code}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreStepper value={scoreH} onChange={(n) => onScore("h", n)} />
          <span className="serif text-[18px] text-muted-warm font-normal mx-0.5">–</span>
          <ScoreStepper value={scoreA} onChange={(n) => onScore("a", n)} />
        </div>
        <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <div className="serif font-semibold text-[15px] leading-tight tracking-[-0.015em] truncate">
              {away.name}
            </div>
            <div className="mono text-[9px] tracking-[0.08em] text-muted-warm mt-0.5">
              {away.short_code}
            </div>
          </div>
          <TeamFlag team={away} />
        </div>
      </div>

      {/* ── Mobile: teams on top, score steppers below ── */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TeamFlag team={home} size={24} />
            <span className="mono text-[11px] font-bold tracking-[0.06em]">{home.short_code}</span>
          </div>
          <span className="serif italic text-[14px] text-muted-warm">vs</span>
          <div className="flex items-center gap-2">
            <span className="mono text-[11px] font-bold tracking-[0.06em]">{away.short_code}</span>
            <TeamFlag team={away} size={24} />
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          <ScoreStepper value={scoreH} onChange={(n) => onScore("h", n)} compact />
          <span className="serif text-[18px] text-muted-warm font-normal">–</span>
          <ScoreStepper value={scoreA} onChange={(n) => onScore("a", n)} compact />
        </div>
      </div>
    </>
  );
}

/* ── Static Match Row (read-only, no steppers) ──────────────── */
function MatchRowStatic({
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
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <TeamFlag team={home} />
        <div className="min-w-0">
          <div className="serif font-semibold text-[15px] leading-tight tracking-[-0.015em] truncate">
            {home?.name ?? homeFallback}
          </div>
          <div className="mono text-[9px] tracking-[0.08em] text-muted-warm mt-0.5">
            {home?.short_code ?? homeFallback}
          </div>
        </div>
      </div>
      <div className="serif italic text-[18px] text-muted-warm font-normal px-2">vs</div>
      <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end text-right">
        <div className="min-w-0">
          <div className="serif font-semibold text-[15px] leading-tight tracking-[-0.015em] truncate">
            {away?.name ?? awayFallback}
          </div>
          <div className="mono text-[9px] tracking-[0.08em] text-muted-warm mt-0.5">
            {away?.short_code ?? awayFallback}
          </div>
        </div>
        <TeamFlag team={away} />
      </div>
    </div>
  );
}

/* ── Saved Prediction Card ──────────────────────────────────── */
function SavedPrediction({
  homeCode,
  awayCode,
  homeFlag,
  awayFlag,
  homeName,
  awayName,
  scoreH,
  scoreA,
  savedAt,
  canEdit,
  matchLocked,
  onEdit,
}: {
  homeCode: string;
  awayCode: string;
  homeFlag?: string | null;
  awayFlag?: string | null;
  homeName: string;
  awayName: string;
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
      {/* Score row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {homeFlag && (
            <div className="w-7 h-7 rounded-full overflow-hidden border border-ink/20 shrink-0">
              <Image src={homeFlag} alt={homeName} width={28} height={28} className="object-cover w-full h-full" />
            </div>
          )}
          <span className="mono text-[10px] font-bold tracking-[0.06em]">{homeCode}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="serif font-semibold text-[28px] tracking-[-0.02em] text-ink leading-none">{scoreH}</span>
          <span className="serif text-[20px] text-muted-warm font-normal">–</span>
          <span className="serif font-semibold text-[28px] tracking-[-0.02em] text-ink leading-none">{scoreA}</span>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="mono text-[10px] font-bold tracking-[0.06em]">{awayCode}</span>
          {awayFlag && (
            <div className="w-7 h-7 rounded-full overflow-hidden border border-ink/20 shrink-0">
              <Image src={awayFlag} alt={awayName} width={28} height={28} className="object-cover w-full h-full" />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.06em] text-good">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Predicted · {savedAt}</span>
          <span className="sm:hidden">Saved</span>
          <span className="mono text-[9px] px-1.5 py-0.5 bg-ink text-paper font-semibold tracking-[0.1em]">
            {outcomeLabel(outcome)}
          </span>
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
    </div>
  );
}
