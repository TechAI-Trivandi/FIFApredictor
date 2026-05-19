import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { matchId, homeScore, awayScore, result, status } = await request.json();

  if (matchId == null) {
    return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // If resetting to scheduled: clear scores, result, and zero out prediction points
  if (status === "scheduled") {
    const { error } = await adminClient
      .from("matches")
      .update({
        home_score: null,
        away_score: null,
        result: null,
        status: "scheduled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reset all prediction points for this match back to 0
    await adminClient
      .from("predictions")
      .update({ points_awarded: 0 })
      .eq("match_id", matchId);

    // Refresh the leaderboard
    await adminClient.rpc("refresh_leaderboard");

    return NextResponse.json({ success: true, message: "Match reset to scheduled" });
  }

  // Normal score update — require scores
  if (homeScore == null || awayScore == null) {
    return NextResponse.json({ error: "Missing score fields" }, { status: 400 });
  }

  const { error } = await adminClient
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      result,
      status: status || "finished",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
