"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";

interface PlayerData {
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  correct_predictions: number;
  total_predictions: number;
  rank: number;
  weekly_points: number;
  form: number[];
}

export function PlayerAvatar({
  player,
  size = 32,
  className = "",
  initialsBg = "bg-ink text-paper",
}: {
  player: PlayerData;
  size?: number;
  className?: string;
  initialsBg?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const initial = player.display_name.charAt(0).toUpperCase();
  const accuracy =
    player.total_predictions > 0
      ? Math.round((player.correct_predictions / player.total_predictions) * 100)
      : 0;

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const cardW = 340;
    const cardH = 420;
    const pad = 12;

    // Try to place to the right of the avatar
    let left = rect.right + pad;
    let top = rect.top + rect.height / 2 - cardH / 2;

    // If card goes off right edge, place to the left
    if (left + cardW > window.innerWidth - pad) {
      left = rect.left - cardW - pad;
    }
    // If still off left edge, center horizontally
    if (left < pad) {
      left = Math.max(pad, (window.innerWidth - cardW) / 2);
    }
    // Clamp vertical
    if (top < pad) top = pad;
    if (top + cardH > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - cardH - pad);
    }

    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    calcPosition();
    window.addEventListener("resize", calcPosition);
    return () => window.removeEventListener("resize", calcPosition);
  }, [open, calcPosition]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(true)}
        className={`rounded-full overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-brand transition-shadow ${className}`}
        style={{ width: size, height: size }}
      >
        {player.avatar_url ? (
          <Image
            src={player.avatar_url}
            alt={player.display_name}
            width={size}
            height={size}
            className="object-cover w-full h-full"
          />
        ) : (
          <div
            className={`w-full h-full grid place-items-center serif italic font-semibold tracking-[-0.02em] ${initialsBg}`}
            style={{ fontSize: Math.round(size * 0.38) }}
          >
            {initial}
          </div>
        )}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          {pos && (
            <div
              ref={cardRef}
              className="fixed z-10 bg-paper border border-ink p-6 sm:p-8 w-[340px] max-w-[90vw] screen-rise"
              style={{ top: pos.top, left: pos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 text-muted-warm hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Rank badge */}
              <div className="mono text-[10px] tracking-[0.18em] uppercase text-muted-warm mb-4">
                Rank #{String(player.rank).padStart(2, "0")}
              </div>

              {/* Large avatar */}
              <div className="flex justify-center mb-5">
                {player.avatar_url ? (
                  <div className="w-[120px] h-[120px] rounded-full overflow-hidden border-[3px] border-ink">
                    <Image
                      src={player.avatar_url}
                      alt={player.display_name}
                      width={240}
                      height={240}
                      className="object-cover w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="w-[120px] h-[120px] rounded-full bg-ink text-paper grid place-items-center serif italic font-semibold text-[42px] tracking-[-0.02em]">
                    {initial}
                  </div>
                )}
              </div>

              {/* Name */}
              <h3 className="serif font-semibold text-[24px] tracking-[-0.025em] text-ink text-center leading-tight">
                {player.display_name}
              </h3>

              {/* Points */}
              <div className="text-center mt-1">
                <span className="serif font-semibold text-[40px] tracking-[-0.035em] num text-ink leading-none">
                  {player.total_points}
                </span>
                <span className="mono text-[10px] tracking-[0.18em] uppercase text-muted-warm ml-1.5">
                  pts
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-px bg-line mt-5 border border-line">
                <StatCell label="Accuracy" value={`${accuracy}%`} />
                <StatCell label="Predictions" value={`${player.total_predictions}`} />
                <StatCell
                  label="This Week"
                  value={player.weekly_points > 0 ? `+${player.weekly_points}` : `${player.weekly_points}`}
                  color={player.weekly_points > 0 ? "text-good" : player.weekly_points < 0 ? "text-bad" : undefined}
                />
              </div>

              {/* Form */}
              {player.form.length > 0 && (
                <div className="mt-5">
                  <div className="mono text-[9px] tracking-[0.18em] uppercase text-muted-warm mb-2">
                    Recent Form
                  </div>
                  <div className="flex gap-[3px]">
                    {padForm(player.form).map((pts, i) => {
                      let bg: string;
                      let label: string;
                      if (pts === 5) { bg = "bg-good"; label = "+5"; }
                      else if (pts === 2) { bg = "bg-crown"; label = "+2"; }
                      else if (pts === 0) { bg = "bg-bad"; label = "0"; }
                      else { bg = "bg-paper-deep"; label = "–"; }

                      return (
                        <div key={i} className={`flex-1 h-6 ${bg} grid place-items-center`}>
                          <span className="mono text-[9px] font-bold text-white/80">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Correct / Total */}
              <div className="mono text-[10px] tracking-[0.04em] text-muted-warm text-center mt-4">
                {player.correct_predictions} correct out of {player.total_predictions} predictions
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-paper py-3 text-center">
      <div className="mono text-[9px] tracking-[0.14em] uppercase text-muted-warm mb-1">{label}</div>
      <div className={`serif font-semibold text-[18px] tracking-[-0.02em] num ${color ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

function padForm(form: number[]): number[] {
  const blocks = [...form];
  while (blocks.length < 5) blocks.push(-1);
  return blocks;
}
