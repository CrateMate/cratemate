import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(_req: Request, { params }: { params: Promise<{ session_id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { session_id } = await params;
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  // Ensure the session belongs to this user before deleting
  const { data } = await supabase
    .from("play_sessions")
    .select("id")
    .eq("id", session_id)
    .eq("user_id", userId)
    .single();

  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { error } = await supabase.from("play_sessions").delete().eq("id", session_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
