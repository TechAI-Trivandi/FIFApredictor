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
  const { count: totalPredictions } = await admin.from("predictions").select("*", { count: "exact", head: true });

  // Per-user prediction counts using the admin client (no row limit)
  const profiles = allProfiles ?? [];
  const predCountByUser: Record<string, number> = {};

  // Fetch in batches per user to avoid any row limits
  for (const p of profiles) {
    const { count } = await admin
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", p.id);
    predCountByUser[p.id] = count ?? 0;
  }

  const withPreds = profiles.filter((p) => (predCountByUser[p.id] ?? 0) > 0);
  const withoutPreds = profiles.filter((p) => (predCountByUser[p.id] ?? 0) === 0);
  const total = totalPredictions ?? 0;

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
