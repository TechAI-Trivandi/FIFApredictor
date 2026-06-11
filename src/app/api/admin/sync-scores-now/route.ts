import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const API_BASE = "https://api.football-data.org/v4";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const adminClient = createAdminClient();

  const { data: pendingMatches } = await adminClient
    .from("matches")
    .select("id, api_fixture_id, status")
    .in("status", ["scheduled", "live"])
    .not("api_fixture_id", "is", null);

  if (!pendingMatches || pendingMatches.length === 0) {
    return NextResponse.json({
      message: "No matches to sync. Either no fixtures are mapped yet, or all matches are finished.",
      updated: 0,
    });
  }

  // Fetch all WC matches and filter locally
  const res = await fetch(`${API_BASE}/competitions/WC/matches?season=2026`, {
    headers: { "X-Auth-Token": apiKey },
  });

  if (!res.ok) {
    const errorText = await res.text();
    return NextResponse.json({
      error: "football-data.org request failed",
      details: errorText,
      hint: res.status === 429
        ? "Rate limit exceeded. Free tier allows ~10 requests/minute."
        : undefined,
    }, { status: 502 });
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

    const status = fixture.status;
    const homeGoals = fixture.score?.fullTime?.home;
    const awayGoals = fixture.score?.fullTime?.away;

    if (status === "FINISHED") {
      // Guard: never finalize a match without real numeric scores.
      // A FINISHED status with null fullTime scores would break scoring —
      // the DB trigger requires non-null scores and silently awards nothing.
      if (typeof homeGoals !== "number" || typeof awayGoals !== "number") {
        if (match.status !== "live") {
          await adminClient
            .from("matches")
            .update({ status: "live", updated_at: new Date().toISOString() })
            .eq("id", match.id);
        }
        continue;
      }

      // Derive result from the actual scoreline so they can never disagree.
      const result: "home" | "away" | "draw" =
        homeGoals > awayGoals ? "home" : awayGoals > homeGoals ? "away" : "draw";

      await adminClient
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
      await adminClient
        .from("matches")
        .update({ status: "live", updated_at: new Date().toISOString() })
        .eq("id", match.id);
    }
  }

  return NextResponse.json({ message: "Score sync complete", updated: updatedCount });
}
