import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const { data: allProfiles } = await admin.from("profiles").select("id, display_name");
  const profiles = allProfiles ?? [];

  // Count every prediction per user with a SINGLE paginated sweep instead of one
  // count query per user. Supabase caps each request at 1000 rows, so we page
  // through user_id in 1000-row chunks — a handful of requests total, vs. 60+.
  const predCountByUser: Record<string, number> = {};
  let total = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("predictions")
      .select("user_id")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const row of data) {
      predCountByUser[row.user_id] = (predCountByUser[row.user_id] ?? 0) + 1;
      total++;
    }
    if (data.length < PAGE) break;
  }

  const withPreds = profiles.filter((p) => (predCountByUser[p.id] ?? 0) > 0);
  const withoutPreds = profiles.filter((p) => (predCountByUser[p.id] ?? 0) === 0);

  const recentPredictions = profiles
    .map((p) => ({ display_name: p.display_name, count: predCountByUser[p.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return NextResponse.json({
    totalPredictions: total,
    usersWithPredictions: withPreds.length,
    usersWithoutPredictions: withoutPreds.length,
    avgPerUser: profiles.length > 0 ? Math.round(total / profiles.length) : 0,
    recentPredictions,
    countByUserId: predCountByUser,
  });
}
