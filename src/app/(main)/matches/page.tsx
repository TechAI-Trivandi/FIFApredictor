import { createClient } from "@/lib/supabase/server";
import { MatchesView } from "@/components/matches-view";
import type { Match, Team } from "@/lib/types";

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: matches }, { data: myPicks }] = await Promise.all([
    supabase
      .from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)")
      .order("match_number", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id")
      .eq("user_id", user!.id),
  ]);

  const predictedIds = new Set((myPicks ?? []).map((p) => p.match_id));

  return (
    <MatchesView
      matches={(matches as (Match & { home_team: Team | null; away_team: Team | null })[]) ?? []}
      predictedMatchIds={Array.from(predictedIds)}
    />
  );
}
