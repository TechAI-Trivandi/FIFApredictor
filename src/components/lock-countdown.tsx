"use client";

import { useEffect, useState } from "react";

function formatRemaining(targetIso: string): string | null {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${minutes}M`;
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}M ${seconds}S`;
}

export function LockCountdown({
  lockAt,
  fallback,
}: {
  lockAt: string | null;
  fallback?: string;
}) {
  const [remaining, setRemaining] = useState<string | null>(
    lockAt ? formatRemaining(lockAt) : null
  );

  useEffect(() => {
    if (!lockAt) return;
    const tick = () => setRemaining(formatRemaining(lockAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockAt]);

  if (!lockAt) {
    return <>{fallback ?? "NO OPEN STAGES"}</>;
  }
  if (!remaining) {
    return <>LOCKED</>;
  }
  return <>LOCKS IN {remaining}</>;
}
