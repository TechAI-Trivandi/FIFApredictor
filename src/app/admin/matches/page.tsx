"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS } from "@/lib/constants";

interface MatchWithTeams {
  id: number;
  match_number: number;
  stage: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  result: string | null;
  kickoff_at: string;
  home_team: { name: string; short_code: string };
  away_team: { name: string; short_code: string };
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [editingMatch, setEditingMatch] = useState<MatchWithTeams | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [editStatus, setEditStatus] = useState("finished");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    const { data } = await supabase
      .from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(name, short_code), away_team:teams!matches_away_team_id_fkey(name, short_code)")
      .order("match_number", { ascending: true });
    if (data) setMatches(data as MatchWithTeams[]);
  }

  async function handleSaveScore() {
    if (!editingMatch) return;
    setSaving(true);
    setActionMessage(null);

    if (editStatus === "scheduled") {
      // Reset match — clear scores and result
      const res = await fetch("/api/admin/update-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: editingMatch.id, status: "scheduled" }),
      });
      if (res.ok) {
        setActionMessage(`Match #${editingMatch.match_number} reset to scheduled`);
        setEditingMatch(null);
        setHomeScore("");
        setAwayScore("");
        loadMatches();
      }
      setSaving(false);
      return;
    }

    const hs = parseInt(homeScore);
    const as_ = parseInt(awayScore);
    if (isNaN(hs) || isNaN(as_)) {
      setSaving(false);
      return;
    }

    let result: string;
    if (hs > as_) result = "home";
    else if (as_ > hs) result = "away";
    else result = "draw";

    const res = await fetch("/api/admin/update-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: editingMatch.id,
        homeScore: hs,
        awayScore: as_,
        result,
        status: editStatus,
      }),
    });

    if (res.ok) {
      setActionMessage(`Match #${editingMatch.match_number} updated`);
      setEditingMatch(null);
      setHomeScore("");
      setAwayScore("");
      loadMatches();
    }
    setSaving(false);
  }

  const filtered = filter === "all" ? matches : matches.filter((m) => m.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Match Management</h1>
        <div className="flex gap-2">
          {["all", "scheduled", "live", "finished"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-700">
          {actionMessage}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((match) => (
                <TableRow key={match.id}>
                  <TableCell className="text-gray-500">{match.match_number}</TableCell>
                  <TableCell className="font-medium">
                    {match.home_team?.short_code ?? "TBD"} vs {match.away_team?.short_code ?? "TBD"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {STAGE_LABELS[match.stage] || match.stage}
                  </TableCell>
                  <TableCell>
                    {match.status === "finished" ? (
                      <span className="font-mono">
                        {match.home_score} - {match.away_score}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        match.status === "finished"
                          ? "default"
                          : match.status === "live"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {match.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger
                        render={
                          <Button
                            size="sm"
                            variant="outline"
                          />
                        }
                        onClick={() => {
                          setEditingMatch(match);
                          setHomeScore(match.home_score?.toString() ?? "");
                          setAwayScore(match.away_score?.toString() ?? "");
                          setEditStatus(match.status);
                        }}
                      >
                        Edit
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Manage Match: {match.home_team?.short_code ?? "TBD"} vs{" "}
                            {match.away_team?.short_code ?? "TBD"}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          {/* Status selector */}
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Status</p>
                            <div className="flex gap-2">
                              {["scheduled", "live", "finished"].map((s) => (
                                <Button
                                  key={s}
                                  size="sm"
                                  variant={editStatus === s ? "default" : "outline"}
                                  className="text-xs flex-1"
                                  onClick={() => setEditStatus(s)}
                                >
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Score inputs — only shown when not resetting */}
                          {editStatus !== "scheduled" && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Score</p>
                              <div className="flex gap-4 items-center justify-center">
                                <div className="text-center">
                                  <p className="text-sm font-medium mb-2">
                                    {match.home_team?.name ?? "TBD"}
                                  </p>
                                  <Input
                                    type="number"
                                    min="0"
                                    className="w-20 text-center"
                                    value={homeScore}
                                    onChange={(e) => setHomeScore(e.target.value)}
                                  />
                                </div>
                                <span className="text-lg font-bold mt-6">-</span>
                                <div className="text-center">
                                  <p className="text-sm font-medium mb-2">
                                    {match.away_team?.name ?? "TBD"}
                                  </p>
                                  <Input
                                    type="number"
                                    min="0"
                                    className="w-20 text-center"
                                    value={awayScore}
                                    onChange={(e) => setAwayScore(e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {editStatus === "scheduled" && match.status !== "scheduled" && (
                            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
                              This will clear the score and result, and reset all prediction points for this match to 0.
                            </div>
                          )}

                          <Button
                            className="w-full"
                            onClick={handleSaveScore}
                            disabled={saving || (editStatus !== "scheduled" && (homeScore === "" || awayScore === ""))}
                          >
                            {saving
                              ? "Saving..."
                              : editStatus === "scheduled" && match.status !== "scheduled"
                              ? "Reset Match"
                              : "Save"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
