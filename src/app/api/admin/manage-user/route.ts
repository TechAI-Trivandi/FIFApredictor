import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { action, targetUserId, newRole } = await request.json();

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Prevent self-deletion
  if (action === "delete" && targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  if (action === "delete") {
    // Delete from auth.users — cascades to profiles, predictions, leaderboard
    const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Refresh leaderboard after deletion
    await adminClient.rpc("refresh_leaderboard");

    return NextResponse.json({ success: true, message: "User deleted" });
  }

  if (action === "change_role") {
    if (!newRole || !["admin", "user"].includes(newRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Prevent removing your own admin role
    if (targetUserId === user.id && newRole === "user") {
      return NextResponse.json({ error: "Cannot demote yourself" }, { status: 400 });
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ role: newRole })
      .eq("id", targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Role changed to ${newRole}` });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
