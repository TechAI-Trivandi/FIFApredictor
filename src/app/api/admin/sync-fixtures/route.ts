import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const API_BASE = "https://api.football-data.org/v4";

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

  // Fetch World Cup 2026 fixtures from football-data.org
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
  const fixtures = apiData.matches || [];

  if (fixtures.length === 0) {
    return NextResponse.json({
      message: "No fixtures returned from the API yet. Try again closer to the tournament.",
      synced: 0,
    });
  }

  const adminClient = createAdminClient();

  // Get all our teams to map by name/code
  const { data: teams } = await adminClient.from("teams").select("id, name, short_code");
  if (!teams) {
    return NextResponse.json({ error: "Failed to load teams" }, { status: 500 });
  }

  // Build lookup map: normalized name or code → team id
  const teamByName = new Map<string, number>();
  for (const t of teams) {
    teamByName.set(t.name.toLowerCase().trim(), t.id);
    teamByName.set(t.short_code.toLowerCase().trim(), t.id);
  }

  // Get all our matches
  const { data: ourMatches } = await adminClient
    .from("matches")
    .select("id, home_team_id, away_team_id, kickoff_at, stage");
  if (!ourMatches) {
    return NextResponse.json({ error: "Failed to load matches" }, { status: 500 });
  }

  let updatedCount = 0;
  const unmatched: string[] = [];

  for (const fixture of fixtures) {
    const homeName = fixture.homeTeam?.name?.toLowerCase().trim();
    const homeTla = fixture.homeTeam?.tla?.toLowerCase().trim();
    const awayName = fixture.awayTeam?.name?.toLowerCase().trim();
    const awayTla = fixture.awayTeam?.tla?.toLowerCase().trim();
    const fixtureId = fixture.id;

    if (!fixtureId || !homeName || !awayName) continue;

    // Try matching by TLA first (more reliable), then by name
    const homeTeamId = teamByName.get(homeTla) || teamByName.get(homeName);
    const awayTeamId = teamByName.get(awayTla) || teamByName.get(awayName);

    if (!homeTeamId || !awayTeamId) {
      unmatched.push(`${fixture.homeTeam?.name} vs ${fixture.awayTeam?.name}`);
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
        kickoff_at: fixture.utcDate,
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
