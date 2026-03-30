import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Genre-based audio profile estimates (mirrors overlap route)
const GENRE_PROFILES: Record<string, { energy: number; valence: number; danceability: number; acousticness: number; loudness: number }> = {
  "electronic": { energy: 0.82, valence: 0.58, danceability: 0.78, acousticness: 0.05, loudness: 0.89 },
  "house": { energy: 0.86, valence: 0.64, danceability: 0.87, acousticness: 0.02, loudness: 0.89 },
  "techno": { energy: 0.88, valence: 0.48, danceability: 0.84, acousticness: 0.02, loudness: 0.93 },
  "ambient": { energy: 0.28, valence: 0.45, danceability: 0.25, acousticness: 0.75, loudness: 0.37 },
  "jazz": { energy: 0.44, valence: 0.58, danceability: 0.55, acousticness: 0.72, loudness: 0.59 },
  "classical": { energy: 0.34, valence: 0.52, danceability: 0.28, acousticness: 0.92, loudness: 0.19 },
  "metal": { energy: 0.92, valence: 0.38, danceability: 0.55, acousticness: 0.05, loudness: 0.85 },
  "punk": { energy: 0.90, valence: 0.55, danceability: 0.65, acousticness: 0.05, loudness: 0.81 },
  "rock": { energy: 0.76, valence: 0.54, danceability: 0.60, acousticness: 0.15, loudness: 0.78 },
  "pop": { energy: 0.68, valence: 0.70, danceability: 0.72, acousticness: 0.20, loudness: 0.85 },
  "hip hop": { energy: 0.70, valence: 0.55, danceability: 0.80, acousticness: 0.15, loudness: 0.81 },
  "r&b": { energy: 0.60, valence: 0.60, danceability: 0.74, acousticness: 0.30, loudness: 0.78 },
  "soul": { energy: 0.62, valence: 0.66, danceability: 0.70, acousticness: 0.40, loudness: 0.70 },
  "funk": { energy: 0.78, valence: 0.72, danceability: 0.82, acousticness: 0.15, loudness: 0.74 },
  "blues": { energy: 0.52, valence: 0.48, danceability: 0.58, acousticness: 0.55, loudness: 0.67 },
  "folk": { energy: 0.42, valence: 0.58, danceability: 0.45, acousticness: 0.78, loudness: 0.59 },
  "reggae": { energy: 0.58, valence: 0.72, danceability: 0.78, acousticness: 0.30, loudness: 0.74 },
  "latin": { energy: 0.72, valence: 0.78, danceability: 0.84, acousticness: 0.22, loudness: 0.81 },
  "disco": { energy: 0.80, valence: 0.78, danceability: 0.88, acousticness: 0.08, loudness: 0.78 },
};

type RecordSlim = { artist: string; genre?: string | null; genres?: string | null; styles?: string | null; year_original?: number | null; year_pressed?: number | null };

function estimateFeatures(r: RecordSlim) {
  const combined = `${r.genre || ""} ${r.genres || ""} ${r.styles || ""}`.toLowerCase();
  const match = Object.entries(GENRE_PROFILES).find(([key]) => combined.includes(key));
  const base = match ? { ...match[1] } : { energy: 0.60, valence: 0.55, danceability: 0.60, acousticness: 0.40, loudness: 0.70 };
  const year = r.year_original || r.year_pressed;
  if (year && year < 1965) base.acousticness = Math.min(1, base.acousticness + 0.2);
  else if (year && year >= 1990) base.acousticness = Math.max(0, base.acousticness - 0.08);
  return base;
}

function soundSimilarity(a: RecordSlim[], b: RecordSlim[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const keys = ["energy", "valence", "danceability", "acousticness", "loudness"] as const;
  const avg = (recs: RecordSlim[]) => {
    const feats = recs.map(estimateFeatures);
    const result: Record<string, number> = {};
    for (const k of keys) result[k] = feats.reduce((s, f) => s + f[k], 0) / feats.length;
    return result;
  };
  const pa = avg(a), pb = avg(b);
  // 1 - normalized Euclidean distance across 5 dimensions
  const dist = Math.sqrt(keys.reduce((s, k) => s + Math.pow(pa[k] - pb[k], 2), 0) / keys.length);
  return Math.max(0, 1 - dist);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: myRecords } = await supabase
    .from("records")
    .select("artist, genre, genres, styles, year_original, year_pressed")
    .eq("user_id", userId)
    .eq("for_sale", false)
    .limit(10000);

  const myList = (myRecords || []) as RecordSlim[];
  const myArtists = new Set(myList.map((r) => (r.artist || "").toLowerCase().trim()).filter(Boolean));

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const myDisplayName = myProfile?.display_name;

  const { data: discoverableProfiles } = await supabase
    .from("user_profiles")
    .select("user_id, display_name")
    .eq("is_discoverable", true)
    .neq("user_id", userId)
    .limit(20);

  if (!discoverableProfiles || discoverableProfiles.length === 0) {
    return NextResponse.json([]);
  }

  const results = await Promise.all(
    discoverableProfiles.map(async (profile) => {
      const { data: theirRecords } = await supabase
        .from("records")
        .select("artist, genre, genres, styles, year_original, year_pressed")
        .eq("user_id", profile.user_id)
        .eq("for_sale", false)
        .limit(10000);

      const theirList = (theirRecords || []) as RecordSlim[];
      const theirArtists = new Set(theirList.map((r) => (r.artist || "").toLowerCase().trim()).filter(Boolean));

      const sharedArtists = [...theirArtists].filter((a) => myArtists.has(a)).length;
      const unionSize = new Set([...myArtists, ...theirArtists]).size;
      const artistPct = unionSize > 0 ? sharedArtists / unionSize : 0;
      const soundPct = soundSimilarity(myList, theirList);

      // 50% artist overlap + 50% sound profile similarity
      const similarityPct = Math.round((artistPct * 0.5 + soundPct * 0.5) * 100);

      return {
        username: profile.display_name,
        user_id: profile.user_id,
        record_count: theirList.length,
        shared_artists: sharedArtists,
        similarity_pct: similarityPct,
      };
    })
  );

  const top10 = results
    .filter((r) => r.username && r.username !== myDisplayName)
    .sort((a, b) => b.similarity_pct - a.similarity_pct)
    .slice(0, 10);

  return NextResponse.json(top10);
}
