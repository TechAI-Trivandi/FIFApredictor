import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
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

  const adminClient = createAdminClient();

  // Delete all predictions using the service role (bypasses RLS)
  const { error } = await adminClient
    .from("predictions")
    .delete()
    .neq("id", 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Refresh leaderboard to reflect zero predictions
  await adminClient.rpc("refresh_leaderboard");

  return NextResponse.json({ success: true });
}
