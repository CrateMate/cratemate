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

  // Fetch up to 20 discoverable users (excluding current user)
  const { data: discoverableTokens } = await supabase
    .from("discogs_tokens")
    .select("user_id, discogs_username")
    .eq("is_discoverable", true)
    .neq("user_id", userId)
    .limit(20);

  if (!discoverableTokens || discoverableTokens.length === 0) {
    return NextResponse.json([]);
  }

  // For each discoverable user, fetch their records and compute similarity
  const results = await Promise.all(
    discoverableTokens.map(async (token) => {
      const { data: theirRecords } = await supabase
        .from("records")
        .select("artist")
        .eq("user_id", token.user_id)
        .eq("for_sale", false);

      const theirArtists = (theirRecords || [])
        .map((r) => (r.artist || "").toLowerCase().trim())
        .filter(Boolean);

      const sharedArtists = theirArtists.filter((a) => myArtists.has(a)).length;
      const recordCount = theirArtists.length;
      const similarityPct =
        myArtists.size > 0 ? Math.round((sharedArtists / myArtists.size) * 100) : 0;

      return {
        username: token.discogs_username,
        record_count: recordCount,
        shared_artists: sharedArtists,
        similarity_pct: similarityPct,
      };
    })
  );

  // Return top 10 sorted by shared artists desc
  const top10 = results
    .filter((r) => r.username)
    .sort((a, b) => b.shared_artists - a.shared_artists)
    .slice(0, 10);

  return NextResponse.json(top10);
}
