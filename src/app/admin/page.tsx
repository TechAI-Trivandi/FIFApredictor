"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { STAGE_LABELS } from "@/lib/constants";
import { RefreshCw, Zap } from "lucide-react";

interface StageLock {
  stage: string;
  locked: boolean;
  predictions_open: boolean;
}

export default function AdminPage() {
  const [stageLocks, setStageLocks] = useState<StageLock[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [finishedCount, setFinishedCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: locks } = await supabase.from("stage_locks").select("*");
    if (locks) {
      const order = ["group", "round_of_32", "round_of_16", "quarter_final", "semi_final", "third_place", "final"];
      setStageLocks([...locks].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage)));
    }

    const { count: users } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    setUserCount(users ?? 0);

    const { count: finished } = await supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "finished");
    setFinishedCount(finished ?? 0);
  }

  async function toggleStage(stage: string, field: "locked" | "predictions_open", value: boolean) {
    await supabase
      .from("stage_locks")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("stage", stage);
    loadData();
  }

  async function syncFixtures() {
    setSyncing("fixtures");
    setSyncStatus(null);
    const res = await fetch("/api/admin/sync-fixtures", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setSyncStatus(`${data.message} — ${data.synced} fixtures mapped${data.totalFromApi ? ` (${data.totalFromApi} returned by API)` : ""}`);
    } else {
      setSyncStatus(`${data.error}${data.hint ? " — " + data.hint : ""}`);
    }
    setSyncing(null);
    loadData();
  }

  async function syncScores() {
    setSyncing("scores");
    setSyncStatus(null);
    const res = await fetch("/api/admin/sync-scores-now", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setSyncStatus(`${data.message} — ${data.updated} matches updated`);
    } else {
      setSyncStatus(`${data.error}`);
    }
    setSyncing(null);
    loadData();
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow mb-2">Control Panel</div>
        <h1 className="display-heading text-4xl sm:text-5xl text-brand-navy">Admin</h1>
        <p className="text-gray-600 mt-3 text-sm">Tournament controls</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/users">
          <Card className="border-gray-200 hover:border-gray-900 transition-colors cursor-pointer">
            <CardContent className="p-5">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Users</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{userCount}</div>
              <p className="text-xs text-gray-500 mt-1">registered players</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/matches">
          <Card className="border-gray-200 hover:border-gray-900 transition-colors cursor-pointer">
            <CardContent className="p-5">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Matches</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{finishedCount} / 104</div>
              <p className="text-xs text-gray-500 mt-1">completed</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stage Lock Controls */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
          Stage Controls
        </h2>
        <Card className="border-gray-200">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {stageLocks.map((sl) => {
                const isOpen = sl.predictions_open && !sl.locked;
                return (
                  <div
                    key={sl.stage}
                    className="flex items-center justify-between px-5 py-3 gap-4"
                  >
                    <div>
                      <span className="font-semibold text-gray-900 text-sm">
                        {STAGE_LABELS[sl.stage] || sl.stage}
                      </span>
                      <div className="mt-0.5 text-xs">
                        {isOpen ? (
                          <span className="text-[#B8252A] font-semibold">Predictions open</span>
                        ) : sl.locked ? (
                          <span className="text-gray-400">Locked</span>
                        ) : (
                          <span className="text-gray-400">Closed</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={sl.predictions_open ? "default" : "outline"}
                        className={`text-xs ${sl.predictions_open ? "bg-gray-900 hover:bg-black" : ""}`}
                        onClick={() => toggleStage(sl.stage, "predictions_open", !sl.predictions_open)}
                      >
                        {sl.predictions_open ? "Open" : "Closed"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => toggleStage(sl.stage, "locked", !sl.locked)}
                      >
                        {sl.locked ? "Unlock" : "Lock"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Testing Tools */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
          Testing Tools
        </h2>
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <p className="text-sm text-gray-600 mb-4">
              Clear all predictions for user testing. This removes every prediction from every user.
            </p>
            <Button
              onClick={async () => {
                if (!confirm("Are you sure? This will delete ALL predictions from ALL users.")) return;
                setSyncing("clearing");
                const { error } = await supabase.from("predictions").delete().neq("id", 0);
                if (error) {
                  setSyncStatus(`Failed to clear: ${error.message}`);
                } else {
                  setSyncStatus("All predictions cleared.");
                }
                setSyncing(null);
              }}
              disabled={syncing !== null}
              variant="outline"
              size="sm"
              className="text-xs border-red-300 text-red-600 hover:bg-red-50"
            >
              {syncing === "clearing" ? "Clearing..." : "Clear All Predictions"}
            </Button>
            {syncStatus && syncStatus.includes("predictions") && (
              <div className="mt-3 p-3 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-700">
                {syncStatus}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Football API */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
          Football API
        </h2>
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <p className="text-sm text-gray-600 mb-4">
              Auto-sync fixtures and live scores from football-data.org. Scores update
              automatically every 15 minutes via cron during the tournament.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={syncFixtures}
                disabled={syncing !== null}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing === "fixtures" ? "animate-spin" : ""}`} />
                {syncing === "fixtures" ? "Syncing..." : "Sync Fixtures"}
              </Button>
              <Button
                onClick={syncScores}
                disabled={syncing !== null}
                size="sm"
                className="text-xs bg-gray-900 hover:bg-black"
              >
                <Zap className={`h-3.5 w-3.5 mr-1.5 ${syncing === "scores" ? "animate-pulse" : ""}`} />
                {syncing === "scores" ? "Syncing..." : "Sync Scores"}
              </Button>
            </div>
            {syncStatus && (
              <div className="mt-3 p-3 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-700">
                {syncStatus}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
