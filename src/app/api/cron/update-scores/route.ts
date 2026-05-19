import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const API_BASE = "https://api.football-data.org/v4";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();

  const { data: pendingMatches } = await supabase
    .from("matches")
    .select("id, api_fixture_id, status")
    .in("status", ["scheduled", "live"])
    .not("api_fixture_id", "is", null);

  if (!pendingMatches || pendingMatches.length === 0) {
    return NextResponse.json({ message: "No matches to update", updated: 0 });
  }

  // football-data.org: fetch all WC matches and filter locally
  // (no batch-by-ID endpoint like API-Football)
  const res = await fetch(`${API_BASE}/competitions/WC/matches?season=2026`, {
    headers: { "X-Auth-Token": apiKey },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "football-data.org request failed" }, { status: 502 });
  }

  const apiData = await res.json();
  const allMatches = apiData.matches || [];

  // Build lookup: football-data.org fixture ID → match data
  const fixtureMap = new Map<number, typeof allMatches[0]>();
  for (const m of allMatches) {
    fixtureMap.set(m.id, m);
  }

  let updatedCount = 0;

  for (const match of pendingMatches) {
    const fixture = fixtureMap.get(match.api_fixture_id);
    if (!fixture) continue;

    const status = fixture.status; // TIMED, SCHEDULED, IN_PLAY, PAUSED, FINISHED, etc.
    const homeGoals = fixture.score?.fullTime?.home;
    const awayGoals = fixture.score?.fullTime?.away;

    if (status === "FINISHED") {
      let result: "home" | "away" | "draw";
      if (fixture.score.winner === "HOME_TEAM") result = "home";
      else if (fixture.score.winner === "AWAY_TEAM") result = "away";
      else result = "draw";

      await supabase
        .from("matches")
        .update({
          home_score: homeGoals,
          away_score: awayGoals,
          result,
          status: "finished",
          updated_at: new Date().toISOString(),
        })
        .eq("id", match.id);

      updatedCount++;
    } else if (status === "IN_PLAY" || status === "PAUSED") {
      await supabase
        .from("matches")
        .update({ status: "live", updated_at: new Date().toISOString() })
        .eq("id", match.id);
    }
  }

  return NextResponse.json({ message: "Scores updated", updated: updatedCount });
}
