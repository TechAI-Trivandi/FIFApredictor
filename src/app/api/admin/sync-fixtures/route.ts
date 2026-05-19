import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const API_BASE = "https://v3.football.api-sports.io";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Fetch World Cup 2026 fixtures (League 1, Season 2026)
  const res = await fetch(`${API_BASE}/fixtures?league=1&season=2026`, {
    headers: { "x-apisports-key": apiKey },
  });

  const apiData = await res.json();

  // Check if API returned an error (e.g. plan restriction)
  if (apiData.errors && Object.keys(apiData.errors).length > 0) {
    return NextResponse.json({
      error: "API returned an error",
      details: apiData.errors,
      hint: "Free API-Football plan doesn't include 2026 data. Upgrade to a paid plan, or use manual score entry.",
    }, { status: 502 });
  }

  const fixtures = apiData.response || [];

  if (fixtures.length === 0) {
    return NextResponse.json({
      message: "No fixtures returned from the API yet. Try again closer to the tournament.",
      synced: 0,
    });
  }

  const adminClient = createAdminClient();

  // Get all our teams to map by name
  const { data: teams } = await adminClient.from("teams").select("id, name, short_code");
  if (!teams) {
    return NextResponse.json({ error: "Failed to load teams" }, { status: 500 });
  }

  // Map of normalized name → team id
  const teamByName = new Map<string, number>();
  for (const t of teams) {
    teamByName.set(t.name.toLowerCase().trim(), t.id);
    teamByName.set(t.short_code.toLowerCase().trim(), t.id);
  }

  // Get all our matches
  const { data: ourMatches } = await adminClient.from("matches").select("id, home_team_id, away_team_id, kickoff_at, stage");
  if (!ourMatches) {
    return NextResponse.json({ error: "Failed to load matches" }, { status: 500 });
  }

  let updatedCount = 0;
  const unmatched: string[] = [];

  for (const fixture of fixtures) {
    const homeName = fixture.teams?.home?.name?.toLowerCase().trim();
    const awayName = fixture.teams?.away?.name?.toLowerCase().trim();
    const fixtureDate = fixture.fixture?.date;
    const fixtureId = fixture.fixture?.id;

    if (!fixtureId) continue;

    const homeTeamId = teamByName.get(homeName);
    const awayTeamId = teamByName.get(awayName);

    if (!homeTeamId || !awayTeamId) {
      unmatched.push(`${fixture.teams?.home?.name} vs ${fixture.teams?.away?.name}`);
      continue;
    }

    // Find a matching match in our DB by team pairing
    const ourMatch = ourMatches.find(
      (m) =>
        m.home_team_id === homeTeamId &&
        m.away_team_id === awayTeamId
    );

    if (!ourMatch) continue;

    await adminClient
      .from("matches")
      .update({
        api_fixture_id: fixtureId,
        kickoff_at: fixtureDate,
      })
      .eq("id", ourMatch.id);

    updatedCount++;
  }

  return NextResponse.json({
    message: "Sync complete",
    synced: updatedCount,
    totalFromApi: fixtures.length,
    unmatched: unmatched.slice(0, 10),
  });
}
