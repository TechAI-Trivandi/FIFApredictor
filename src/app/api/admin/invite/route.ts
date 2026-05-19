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

  const { emails } = await request.json();

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "No emails provided" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const results = [];

  for (const email of emails) {
    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${new URL(request.url).origin}/auth/callback?next=/signup`,
    });

    if (!error) {
      await adminClient.from("invitations").insert({
        email,
        invited_by: user.id,
        status: "pending",
      });
      results.push({ email, success: true });
    } else {
      results.push({ email, success: false, error: error.message });
    }
  }

  return NextResponse.json({ results });
}
