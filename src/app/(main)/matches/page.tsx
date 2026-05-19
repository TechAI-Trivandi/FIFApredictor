import { createClient } from "@/lib/supabase/server";
import { MatchesView } from "@/components/matches-view";
import type { Match, Team } from "@/lib/types";

export default async function MatchesPage() {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)")
    .order("match_number", { ascending: true });

  return (
    <MatchesView matches={(matches as (Match & { home_team: Team | null; away_team: Team | null })[]) ?? []} />
  );
}
