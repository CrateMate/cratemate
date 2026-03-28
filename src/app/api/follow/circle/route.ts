import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET: recent plays from users I follow (respects share_plays toggle)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get who I follow
  const { data: follows } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (!follows || follows.length === 0) return NextResponse.json([]);

  const followingIds = follows.map(f => f.following_id);

  // Filter to users who are discoverable AND share plays
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, is_pro, is_discoverable, share_plays")
    .in("user_id", followingIds)
    .eq("is_discoverable", true)
    .eq("share_plays", true);

  if (!profiles || profiles.length === 0) return NextResponse.json([]);

  const activeIds = profiles.map(p => p.user_id);
  const profileMap = new Map(profiles.map(p => [p.user_id, p]));

  // Get recent plays from these users (last 7 days, max 5 per user)
  const { data: plays } = await supabase
    .from("play_sessions")
    .select("user_id, record_id, played_at")
    .in("user_id", activeIds)
    .gte("played_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("played_at", { ascending: false })
    .limit(100);

  if (!plays || plays.length === 0) return NextResponse.json([]);

  // Get record details
  const recordIds = [...new Set(plays.map(p => p.record_id))];
  const { data: records } = await supabase
    .from("records")
    .select("id, title, artist, thumb, genres")
    .in("id", recordIds);

  const recordMap = new Map((records || []).map(r => [r.id, r]));

  // Group by user, max 5 per user
  const userPlays: Record<string, number> = {};
  const result = [];

  for (const play of plays) {
    const count = userPlays[play.user_id] || 0;
    if (count >= 5) continue;
    userPlays[play.user_id] = count + 1;

    const record = recordMap.get(play.record_id);
    const profile = profileMap.get(play.user_id);
    if (!record || !profile) continue;

    result.push({
      username: profile.display_name,
      user_id: play.user_id,
      is_pro: profile.is_pro,
      title: record.title,
      artist: record.artist,
      thumb: record.thumb,
      genres: record.genres,
      played_at: play.played_at,
    });
  }

  return NextResponse.json(result);
}
