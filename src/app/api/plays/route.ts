import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("play_sessions")
    .select("id, record_id, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  const lastPlayed: Record<string, string> = {};
  for (const row of data || []) {
    counts[row.record_id] = (counts[row.record_id] || 0) + 1;
    if (!lastPlayed[row.record_id]) lastPlayed[row.record_id] = row.played_at;
  }

  return NextResponse.json({ counts, lastPlayed, sessions: data || [] });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { record_id } = await request.json();
  if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });

  const played_at = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("play_sessions")
    .insert({ user_id: userId, record_id, played_at })
    .select("id, played_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: inserted?.id, played_at: inserted?.played_at || played_at });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { record_id } = await request.json();
  if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });

  // Delete the most recent play session for this record
  const { data } = await supabase
    .from("play_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("record_id", record_id)
    .order("played_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return NextResponse.json({ error: "No play to undo" }, { status: 404 });

  const { error } = await supabase.from("play_sessions").delete().eq("id", data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
