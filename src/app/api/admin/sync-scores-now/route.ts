import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const API_BASE = "https://v3.football.api-sports.io";

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

  const fixtureIds = pendingMatches.map((m) => m.api_fixture_id).filter(Boolean).join("-");

  const res = await fetch(`${API_BASE}/fixtures?ids=${fixtureIds}`, {
    headers: { "x-apisports-key": apiKey },
  });

  const apiData = await res.json();

  if (apiData.errors && Object.keys(apiData.errors).length > 0) {
    return NextResponse.json({
      error: "API error",
      details: apiData.errors,
    }, { status: 502 });
  }

  const fixtures = apiData.response || [];
  let updatedCount = 0;

  for (const fixture of fixtures) {
    const fixtureId = fixture.fixture.id;
    const status = fixture.fixture.status.short;
    const homeGoals = fixture.goals.home;
    const awayGoals = fixture.goals.away;

    const match = pendingMatches.find((m) => m.api_fixture_id === fixtureId);
    if (!match) continue;

    if (["FT", "AET", "PEN"].includes(status)) {
      let result: "home" | "away" | "draw";
      if (homeGoals > awayGoals) result = "home";
      else if (awayGoals > homeGoals) result = "away";
      else result = "draw";

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
    } else if (["1H", "2H", "HT", "ET", "P"].includes(status)) {
      await adminClient
        .from("matches")
        .update({ status: "live", updated_at: new Date().toISOString() })
        .eq("id", match.id);
    }
  }

  return NextResponse.json({ message: "Score sync complete", updated: updatedCount });
}
