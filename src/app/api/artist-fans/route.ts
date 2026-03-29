import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist")?.slice(0, 200);
  if (!artist) return NextResponse.json({ error: "artist required" }, { status: 400 });

  // Records owned per user for this artist
  const { data: recordData } = await supabase
    .from("records")
    .select("user_id, id")
    .ilike("artist", `%${artist}%`);

  const byOwned: Record<string, number> = {};
  const recordIds: string[] = [];
  for (const row of recordData || []) {
    byOwned[row.user_id] = (byOwned[row.user_id] || 0) + 1;
    recordIds.push(row.id);
  }

  // Plays per user for this artist's records
  const byPlays: Record<string, number> = {};
  if (recordIds.length > 0) {
    const { data: playData } = await supabase
      .from("play_sessions")
      .select("user_id")
      .in("record_id", recordIds);
    for (const row of playData || []) {
      byPlays[row.user_id] = (byPlays[row.user_id] || 0) + 1;
    }
  }

  // Fetch usernames for all users in the ranking
  const allUserIds = [...new Set([...Object.keys(byOwned), ...Object.keys(byPlays)])];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, username")
    .in("user_id", allUserIds);
  const usernameMap: Record<string, string> = {};
  for (const p of profiles || []) {
    if (p.user_id && p.username) usernameMap[p.user_id] = p.username;
  }

  const byOwnedList = Object.entries(byOwned)
    .map(([user_id, count]) => ({ user_id, count, username: usernameMap[user_id] || null }))
    .sort((a, b) => b.count - a.count);

  const byPlaysList = Object.entries(byPlays)
    .map(([user_id, total_plays]) => ({ user_id, total_plays, username: usernameMap[user_id] || null }))
    .sort((a, b) => b.total_plays - a.total_plays);

  return NextResponse.json({ byOwned: byOwnedList, byPlays: byPlaysList, currentUserId: userId });
}
