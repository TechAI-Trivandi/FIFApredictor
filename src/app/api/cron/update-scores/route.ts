import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

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

  const fixtureIds = pendingMatches
    .map((m) => m.api_fixture_id)
    .filter(Boolean)
    .join("-");

  const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?ids=${fixtureIds}`, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "API-Football request failed" }, { status: 502 });
  }

  const apiData = await res.json();
  const fixtures = apiData.response || [];
  let updatedCount = 0;

  for (const fixture of fixtures) {
    const fixtureId = fixture.fixture.id;
    const status = fixture.fixture.status.short;
    const homeGoals = fixture.goals.home;
    const awayGoals = fixture.goals.away;

    const match = pendingMatches.find((m) => m.api_fixture_id === fixtureId);
    if (!match) continue;

    if (status === "FT" || status === "AET" || status === "PEN") {
      let result: string;
      if (homeGoals > awayGoals) result = "home";
      else if (awayGoals > homeGoals) result = "away";
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
    } else if (["1H", "2H", "HT", "ET", "P"].includes(status)) {
      await supabase
        .from("matches")
        .update({ status: "live", updated_at: new Date().toISOString() })
        .eq("id", match.id);
    }
  }

  return NextResponse.json({ message: "Scores updated", updated: updatedCount });
}
