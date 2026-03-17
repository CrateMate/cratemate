import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchAlbumFeatures } from "@/lib/spotify";
import {
  getSpotifyFeaturesCache,
  upsertSpotifyFeaturesCache,
  isSpotifyFeaturesCacheFresh,
  spotifyFeaturesKey,
} from "@/lib/discogs/cache";

// POST: fetch + cache features for one record
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { record_id, artist, title } = await request.json().catch(() => ({}));
  if (!record_id || !artist || !title) {
    return NextResponse.json({ error: "Missing record_id, artist, or title" }, { status: 400 });
  }

  // 1. Check per-record cache (spotify_features table)
  const { data: cached } = await supabase
    .from("spotify_features")
    .select("*")
    .eq("record_id", record_id)
    .single();

  if (cached) return NextResponse.json(cached);

  // 2. Check shared features cache (spotify_features_cache) by artist|title key
  const cacheKey = spotifyFeaturesKey(artist, title);
  const sharedCached = await getSpotifyFeaturesCache(cacheKey);
  if (sharedCached && isSpotifyFeaturesCacheFresh(sharedCached)) {
    // Populate per-record cache and return
    const row = {
      record_id,
      energy: sharedCached.energy,
      valence: sharedCached.valence,
      danceability: sharedCached.danceability,
      acousticness: sharedCached.acousticness,
      tempo: sharedCached.tempo,
      loudness: sharedCached.loudness,
    };
    await supabase.from("spotify_features").upsert(row);
    return NextResponse.json(row);
  }

  // 3. Fetch features from Spotify (search → ReccoBeats audio features)
  const features = await fetchAlbumFeatures(artist, title).catch(() => null);
  if (!features) return NextResponse.json(null);

  // Store in per-record cache
  const row = { record_id, ...features };
  await supabase.from("spotify_features").upsert(row);

  // Store in shared features cache
  await upsertSpotifyFeaturesCache(cacheKey, {
    energy: features.energy,
    valence: features.valence,
    danceability: features.danceability,
    acousticness: features.acousticness,
    tempo: features.tempo,
    loudness: features.loudness,
  });

  return NextResponse.json(row);
}

// GET: return all cached features for the current user's collection
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Join spotify_features with the user's records
  const { data: records } = await supabase
    .from("records")
    .select("id")
    .eq("user_id", userId);

  if (!records || records.length === 0) return NextResponse.json({});

  const ids = records.map((r) => r.id);
  const { data: features } = await supabase
    .from("spotify_features")
    .select("*")
    .in("record_id", ids);

  // Return as a map: { [record_id]: features }
  const map: Record<string, object> = {};
  for (const f of features || []) {
    map[f.record_id] = f;
  }
  return NextResponse.json(map);
}
