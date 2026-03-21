import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch current user's records to get their artists
  const { data: myRecords } = await supabase
    .from("records")
    .select("artist")
    .eq("user_id", userId)
    .eq("for_sale", false);

  const myArtists = new Set(
    (myRecords || []).map((r) => (r.artist || "").toLowerCase().trim()).filter(Boolean)
  );

  // Get current user's display name to exclude self-matches
  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const myDisplayName = myProfile?.display_name;

  // Fetch up to 20 discoverable users (excluding current user)
  const { data: discoverableProfiles } = await supabase
    .from("user_profiles")
    .select("user_id, display_name")
    .eq("is_discoverable", true)
    .neq("user_id", userId)
    .limit(20);

  if (!discoverableProfiles || discoverableProfiles.length === 0) {
    return NextResponse.json([]);
  }

  // For each discoverable user, fetch their records and compute similarity
  const results = await Promise.all(
    discoverableProfiles.map(async (profile) => {
      const { data: theirRecords } = await supabase
        .from("records")
        .select("artist")
        .eq("user_id", profile.user_id)
        .eq("for_sale", false);

      const theirArtists = (theirRecords || [])
        .map((r) => (r.artist || "").toLowerCase().trim())
        .filter(Boolean);

      const sharedArtists = theirArtists.filter((a) => myArtists.has(a)).length;
      const recordCount = theirArtists.length;
      const similarityPct =
        myArtists.size > 0 ? Math.round((sharedArtists / myArtists.size) * 100) : 0;

      return {
        username: profile.display_name,
        record_count: recordCount,
        shared_artists: sharedArtists,
        similarity_pct: similarityPct,
      };
    })
  );

  // Return top 10 sorted by shared artists desc — exclude self
  const top10 = results
    .filter((r) => r.username && r.username !== myDisplayName)
    .sort((a, b) => b.shared_artists - a.shared_artists)
    .slice(0, 10);

  return NextResponse.json(top10);
}
